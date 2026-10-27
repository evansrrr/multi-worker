/**
 * POST /api/batch/deploy - Deploy a ZIP to multiple Pages projects and/or Workers
 *
 * - ZIP 解压统一走 functions/lib/zip.ts（解压失败整体失败，不静默跳过）。
 * - Pages 部署统一走 functions/lib/pages-upload.ts 的 Direct Upload 完整协议。
 * - Worker 部署走经典脚本端点 PUT /workers/scripts/{name}，保留既有绑定。
 */

import {
  getCloudflareToken,
  cloudflareFetch,
  parseCfResponse,
} from "../../lib/cloudflare";
import { unzip, ZipEntry } from "../../lib/zip";
import { directUploadDeploy } from "../../lib/pages-upload";

interface Env {
  TOOL_DATA: KVNamespace;
}

interface BatchTarget {
  accountId: string;
  name: string;
  type: "worker" | "pages";
}

interface BatchResult {
  name: string;
  success: boolean;
  error?: string;
}

async function deployPages(
  token: string,
  accountId: string,
  name: string,
  entries: ZipEntry[]
): Promise<{ success: boolean; error?: string }> {
  try {
    await directUploadDeploy({
      token,
      accountId,
      projectName: name,
      assets: entries.map((e) => ({ path: e.path, content: e.content })),
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message || "Pages deploy failed" };
  }
}

/**
 * Deploy a Worker from a ZIP: extract the entry module and upload it via the
 * classic scripts API (PUT /workers/scripts/{script_name}), preserving the
 * Worker's existing bindings. The previous implementation passed the whole
 * ZIP buffer as a single "worker.js" module, which is wrong.
 */
async function deployWorker(
  token: string,
  accountId: string,
  name: string,
  entries: ZipEntry[]
): Promise<{ success: boolean; error?: string }> {
  // Pick an entry module. Prefer a common entry filename; otherwise use the
  // first .js/.mjs file in the archive.
  const entryCandidates = [
    "worker.js",
    "index.js",
    "main.js",
    "src/worker.js",
    "src/index.js",
    "src/main.js",
  ];
  let entryName: string | undefined;
  for (const candidate of entryCandidates) {
    if (entries.some((e) => e.path === candidate)) {
      entryName = candidate;
      break;
    }
  }
  if (!entryName) {
    entryName = entries.find(
      (e) => e.path.endsWith(".js") || e.path.endsWith(".mjs")
    )?.path;
  }
  if (!entryName) {
    return {
      success: false,
      error: "ZIP 中没有可用的 JavaScript 入口模块（应为 worker.js 或 index.js）",
    };
  }

  const entryData = entries.find((e) => e.path === entryName)!.content;

  // Read existing settings so the upload doesn't wipe bindings / config.
  let existingBindings: unknown[] = [];
  let compatibilityDate: string | undefined;
  try {
    const settingsRes = await cloudflareFetch(
      token,
      `/accounts/${accountId}/workers/scripts/${name}/settings`
    );
    const settingsData = await parseCfResponse<{
      bindings?: unknown[];
      compatibility_date?: string;
    }>(settingsRes);
    if (settingsData.success && settingsData.result) {
      existingBindings = settingsData.result.bindings ?? [];
      compatibilityDate = settingsData.result.compatibility_date;
    }
  } catch {
    // Brand-new script — fall through with empty bindings.
  }

  const metadata = {
    main_module: "worker.js",
    bindings: existingBindings,
    compatibility_date:
      compatibilityDate ?? new Date().toISOString().split("T")[0],
  };

  const formData = new FormData();
  formData.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" })
  );
  formData.append(
    "worker.js",
    new Blob([entryData], { type: "application/javascript+module" }),
    "worker.js"
  );

  // Do NOT set Content-Type manually — fetch must generate the boundary.
  const res = await cloudflareFetch(
    token,
    `/accounts/${accountId}/workers/scripts/${encodeURIComponent(name)}`,
    { method: "PUT", body: formData }
  );

  const data = await parseCfResponse(res);
  if (!data.success) {
    return {
      success: false,
      error: data.errors?.[0]?.message || "Worker deploy failed",
    };
  }
  return { success: true };
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env } = context;

  let formData: FormData;
  try {
    formData = await context.request.formData();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid form data" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const file = formData.get("files");
  if (!file || !(file instanceof File)) {
    return new Response(JSON.stringify({ error: "ZIP file required" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const targetsRaw = formData.get("targets");
  if (!targetsRaw || typeof targetsRaw !== "string") {
    return new Response(JSON.stringify({ error: "targets required" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  let targets: BatchTarget[];
  try {
    targets = JSON.parse(targetsRaw);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid targets JSON" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  if (!Array.isArray(targets) || targets.length === 0) {
    return new Response(JSON.stringify({ error: "targets empty" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const zipBuffer = await file.arrayBuffer();

  // 解压一次，供所有目标复用；失败则整体失败，不产出半截部署。
  let entries: ZipEntry[];
  try {
    entries = await unzip(zipBuffer);
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `ZIP 解析失败：${(err as Error).message}` }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  if (entries.length === 0) {
    return new Response(
      JSON.stringify({ error: "ZIP 中没有可部署的文件" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const results: BatchResult[] = [];

  for (const target of targets) {
    const { accountId, name, type } = target;
    if (!accountId || !name || !type) {
      results.push({ name: name || "unknown", success: false, error: "Missing fields" });
      continue;
    }

    const token = await getCloudflareToken(env, accountId);
    if (!token) {
      results.push({ name, success: false, error: "Account not found" });
      continue;
    }

    try {
      const result = type === "pages"
        ? await deployPages(token, accountId, name, entries)
        : await deployWorker(token, accountId, name, entries);
      results.push({ name, ...result });
    } catch (err) {
      results.push({ name, success: false, error: (err as Error).message || "Deploy failed" });
    }
  }

  return new Response(JSON.stringify({ results }), { status: 200, headers: { "Content-Type": "application/json" } });
};
