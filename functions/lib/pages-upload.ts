/**
 * Cloudflare Pages Direct Upload 完整协议（阶段3 收口，AUDIT M7 + 阶段1 遗留）。
 *
 * 协议依据（当前官方流程，4 步）：
 * 1. GET  /accounts/{account_id}/pages/projects/{project_name}/upload-token
 *        用 API token 换取 1 小时有效的账户级 JWT。
 * 2. POST /pages/assets/upload（无 /accounts 前缀，用 JWT 认证）
 *        body 是 JSON 数组，每项 { base64:true, key:<hash>, metadata:{contentType}, value:<base64> }
 *        （与 KV bulk write 同构）。
 * 3. POST /pages/assets/upsert-hashes（JWT）body { hashes: [<hash>, ...] }，
 *        把已上传的内容哈希注册进资产库，供后续部署复用。
 * 4. POST /accounts/{account_id}/pages/projects/{project_name}/deployments
 *        multipart：manifest 为 {"path":"hash"}，可带 branch / commit_message。
 * 5. 轮询 GET .../deployments/{id}，直到 latest_stage.name === "deploy"
 *        且 status 为 success / failure / cancelled 等终态。
 *
 * 文件哈希（决定性细节，算错会"部署成功但所有资源 404"）：
 *   hash = BLAKE3( base64(文件内容) + 扩展名不带点 ).hex() 的前 32 个字符
 * 该算法取自 wrangler 源码 packages/deploy-helpers/src/deploy/helpers/hash.ts 的
 * hashFile（dev.to/orix 对 wrangler 的逆向记录），不是 SHA-256、不是对原始字节哈希。
 *
 * 注意：本实现经 build + typecheck 验证，但**未经真实账户端到端部署验证**（本地无
 * 有效 CF token）。hash 算法与端点路径均以官方 API 文档 + wrangler 源码为准。
 */

import { blake3 } from "hash-wasm";
import { cloudflareFetch, parseCfResponse } from "./cloudflare";

/** 单个文件不超过 25 MiB（官方 Direct Upload 限制）。 */
const MAX_FILE_BYTES = 25 * 1024 * 1024;
/** manifest 条目上限（官方限制 20000）。 */
const MAX_FILE_COUNT = 20000;
/** 每批 upload 的文件数（控制单次 JSON 请求体大小）。 */
const UPLOAD_BATCH_SIZE = 100;
/** 部署轮询：最多次数与间隔（毫秒）。 */
const POLL_MAX_ATTEMPTS = 60;
const POLL_INTERVAL_MS = 2000;

export interface DirectUploadAsset {
  /** 站点内的相对路径，例如 "index.html"、"assets/logo.svg"。 */
  path: string;
  content: Uint8Array;
}

export interface DirectUploadDeployOptions {
  token: string;
  accountId: string;
  projectName: string;
  assets: DirectUploadAsset[];
  /** 部署分支（preview 环境可自定义分支，production 用项目生产分支）。 */
  branch?: string;
  commitMessage?: string;
}

export interface DirectUploadResult {
  deploymentId: string;
  url?: string;
  environment?: string;
  stageStatus: string;
}

/** 以字节为单位的 base64 编码，分块避免大文件把调用栈打爆。 */
export function base64Encode(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let bin = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

/** 等价 node extname，但只返回去掉点的扩展名（无扩展名返回空串）。 */
export function fileExtension(path: string): string {
  const base = path.slice(path.lastIndexOf("/") + 1);
  const idx = base.lastIndexOf(".");
  return idx <= 0 ? "" : base.slice(idx + 1);
}

/**
 * 计算 Cloudflare Direct Upload 要求的内容哈希：
 * BLAKE3(base64(内容) + 扩展名).hex().slice(0, 32)。
 */
export async function hashFileContent(
  data: Uint8Array,
  path: string
): Promise<string> {
  const base64 = base64Encode(data);
  const ext = fileExtension(path);
  const full = await blake3(base64 + ext);
  return full.slice(0, 32);
}

/** 由扩展名推断 MIME，用于资产库 metadata.contentType。 */
export function contentTypeForPath(path: string): string {
  const ext = fileExtension(path).toLowerCase();
  const table: Record<string, string> = {
    html: "text/html",
    htm: "text/html",
    css: "text/css",
    js: "text/javascript",
    mjs: "text/javascript",
    json: "application/json",
    map: "application/json",
    svg: "image/svg+xml",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    ico: "image/x-icon",
    txt: "text/plain",
    md: "text/markdown",
    xml: "application/xml",
    woff: "font/woff",
    woff2: "font/woff2",
    wasm: "application/wasm",
    pdf: "application/pdf",
  };
  return table[ext] ?? "application/octet-stream";
}

interface DeploymentStage {
  name?: string;
  status?: string;
  started_on?: string;
  ended_on?: string;
}

interface DeploymentResult {
  id?: string;
  url?: string;
  environment?: string;
  latest_stage?: DeploymentStage;
}

const TERMINAL_STATUSES = new Set([
  "success",
  "failure",
  "cancelled",
  "skipped",
]);

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 执行完整的 Direct Upload 流程，返回部署终态。
 * 任何一步失败都会抛出带上下文的 Error（调用方据此返回明确错误）。
 */
export async function directUploadDeploy(
  opts: DirectUploadDeployOptions
): Promise<DirectUploadResult> {
  const { token, accountId, projectName, assets, branch, commitMessage } = opts;

  if (assets.length === 0) {
    throw new Error("ZIP 中没有可部署的文件");
  }
  if (assets.length > MAX_FILE_COUNT) {
    throw new Error(
      `文件数 ${assets.length} 超过上限 ${MAX_FILE_COUNT}（Cloudflare Pages 限制）`
    );
  }

  // 第 0 步：算哈希 + 限额校验 + 路径规范化（Direct Upload 的 manifest 要求前导 /）。
  const hashed: Array<{
    path: string;
    hash: string;
    content: Uint8Array;
    contentType: string;
  }> = [];
  for (const asset of assets) {
    if (asset.content.length > MAX_FILE_BYTES) {
      throw new Error(
        `文件「${asset.path}」超过 25 MiB 上限（实际 ${(asset.content.length / 1024 / 1024).toFixed(1)} MiB）`
      );
    }
    const path = asset.path.startsWith("/") ? asset.path : `/${asset.path}`;
    const hash = await hashFileContent(asset.content, asset.path);
    hashed.push({
      path,
      hash,
      content: asset.content,
      contentType: contentTypeForPath(asset.path),
    });
  }

  // 第 1 步：获取 JWT。
  const tokenRes = await cloudflareFetch(
    token,
    `/accounts/${accountId}/pages/projects/${encodeURIComponent(projectName)}/upload-token`
  );
  const tokenData = await parseCfResponse<{ jwt?: string }>(tokenRes);
  if (!tokenData.success || !tokenData.result?.jwt) {
    const msg =
      tokenData.errors?.[0]?.message || "无法获取 Pages 上传令牌（upload-token）";
    throw new Error(msg);
  }
  const jwt = tokenData.result.jwt;

  // 第 2 步：上传文件内容到资产库（用 JWT 认证，无 /accounts 前缀）。
  for (let i = 0; i < hashed.length; i += UPLOAD_BATCH_SIZE) {
    const batch = hashed.slice(i, i + UPLOAD_BATCH_SIZE);
    const body = batch.map((f) => ({
      base64: true,
      key: f.hash,
      metadata: { contentType: f.contentType },
      value: base64Encode(f.content),
    }));
    const upRes = await cloudflareFetch(jwt, "/pages/assets/upload", {
      method: "POST",
      body: JSON.stringify(body),
    });
    const upData = await parseCfResponse<unknown>(upRes);
    if (!upData.success) {
      throw new Error(
        upData.errors?.[0]?.message || "上传文件内容到资产库失败（assets/upload）"
      );
    }
  }

  // 第 3 步：注册内容哈希，供后续部署复用。
  const hashList = hashed.map((f) => f.hash);
  const upsertRes = await cloudflareFetch(jwt, "/pages/assets/upsert-hashes", {
    method: "POST",
    body: JSON.stringify({ hashes: hashList }),
  });
  const upsertData = await parseCfResponse<unknown>(upsertRes);
  if (!upsertData.success) {
    throw new Error(
      upsertData.errors?.[0]?.message ||
        "注册内容哈希失败（assets/upsert-hashes）"
    );
  }

  // 第 4 步：创建部署（multipart，manifest + 可选 branch/commit_message）。
  const manifest: Record<string, string> = {};
  for (const f of hashed) manifest[f.path] = f.hash;

  const deployForm = new FormData();
  deployForm.append("manifest", JSON.stringify(manifest));
  if (branch) deployForm.append("branch", branch);
  if (commitMessage) deployForm.append("commit_message", commitMessage);

  const deployRes = await cloudflareFetch(
    token,
    `/accounts/${accountId}/pages/projects/${encodeURIComponent(projectName)}/deployments`,
    { method: "POST", body: deployForm }
  );
  const deployData = await parseCfResponse<DeploymentResult>(deployRes);
  if (!deployData.success || !deployData.result?.id) {
    throw new Error(
      deployData.errors?.[0]?.message || "创建部署失败（deployments）"
    );
  }

  // 第 5 步：轮询到终态。
  const deploymentId = deployData.result.id;
  let latestStage: DeploymentStage | undefined;
  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
    await sleep(POLL_INTERVAL_MS);
    const pollRes = await cloudflareFetch(
      token,
      `/accounts/${accountId}/pages/projects/${encodeURIComponent(projectName)}/deployments/${deploymentId}`
    );
    const pollData = await parseCfResponse<DeploymentResult>(pollRes);
    if (!pollData.success) {
      // 轮询中的瞬时失败不立即中断，继续重试。
      continue;
    }
    latestStage = pollData.result?.latest_stage;
    if (
      latestStage?.name === "deploy" &&
      latestStage?.status &&
      TERMINAL_STATUSES.has(latestStage.status)
    ) {
      break;
    }
  }

  const stageStatus = latestStage?.status ?? "unknown";
  if (stageStatus === "failure" || stageStatus === "cancelled") {
    throw new Error(
      `部署失败：Pages 构建在「${latestStage?.name ?? "deploy"}」阶段以状态 ${stageStatus} 结束`
    );
  }
  if (stageStatus !== "success") {
    throw new Error(
      `部署超时：在 ${(POLL_MAX_ATTEMPTS * POLL_INTERVAL_MS) / 1000} 秒内未等到部署终态（当前 ${stageStatus}）`
    );
  }

  return {
    deploymentId,
    url: deployData.result.url,
    environment: deployData.result.environment,
    stageStatus,
  };
}
