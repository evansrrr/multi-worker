/**
 * POST /api/accounts/:id/pages/:name/deploy - Deploy ZIP to Pages project
 *
 * 通过 Cloudflare Pages Direct Upload 完整协议部署（见 functions/lib/pages-upload.ts）：
 * upload-token → assets/upload → assets/upsert-hashes → create-deployment → 轮询终态。
 * ZIP 解压复用 functions/lib/zip.ts（解压失败整体失败，绝不静默跳过）。
 */

import { getCloudflareToken } from "../../../../../lib/cloudflare";
import { unzip } from "../../../../../lib/zip";
import {
  directUploadDeploy,
  DirectUploadAsset,
} from "../../../../../lib/pages-upload";

interface Env {
  TOOL_DATA: KVNamespace;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context;
  const accountId = params.id as string;
  const projectName = params.name as string;

  const token = await getCloudflareToken(env, accountId);
  if (!token) {
    return new Response(
      JSON.stringify({ error: "Account not found or token invalid" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  // 兼容两种调用方式：multipart（file 字段）或 JSON（zip 的 base64）。
  // 前端当前走 multipart，这里优先解析 multipart。
  let zipBuffer: ArrayBuffer | null = null;
  let branch: string | undefined;
  let commitMessage: string | undefined;

  const contentType = request.headers.get("Content-Type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("files") as File | null;
    if (!file) {
      return new Response(
        JSON.stringify({ error: "未收到 ZIP 文件（缺少 files 字段）" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    zipBuffer = await file.arrayBuffer();
    const branchField = formData.get("branch");
    if (typeof branchField === "string" && branchField) branch = branchField;
    const msgField = formData.get("commit_message");
    if (typeof msgField === "string" && msgField) commitMessage = msgField;
  } else {
    // JSON：{ zip: base64, branch?, commit_message? }
    const body = await request.json<{
      zip?: string;
      branch?: string;
      commit_message?: string;
    }>().catch(() => null);
    if (!body?.zip) {
      return new Response(
        JSON.stringify({ error: "缺少 ZIP 内容（zip 字段）" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    branch = body.branch;
    commitMessage = body.commit_message;
    try {
      const bin = atob(body.zip);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      zipBuffer = bytes.buffer;
    } catch {
      return new Response(
        JSON.stringify({ error: "ZIP 内容不是合法的 base64" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  if (!zipBuffer) {
    return new Response(
      JSON.stringify({ error: "未收到 ZIP 文件" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    // 解压：lib/zip.ts 会对损坏/加密/不支持的条目整体抛错，不静默跳过。
    const entries = await unzip(zipBuffer);
    const assets: DirectUploadAsset[] = entries.map((e) => ({
      path: e.path,
      content: e.content,
    }));

    const result = await directUploadDeploy({
      token,
      accountId,
      projectName,
      assets,
      branch,
      commitMessage,
    });

    return new Response(
      JSON.stringify({
        success: true,
        deployment: {
          id: result.deploymentId,
          url: result.url,
          environment: result.environment,
          stage: result.stageStatus,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: `部署失败：${message}` }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
