/**
 * POST /api/batch/deploy - Deploy a ZIP to multiple Pages projects and/or Workers
 */

import { getCloudflareToken } from "../../lib/cloudflare";

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

// Simple ZIP file extraction
async function extractZipFiles(zipBuffer: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const files = new Map<string, Uint8Array>();
  const view = new DataView(zipBuffer);
  const uint8 = new Uint8Array(zipBuffer);

  let eocdOffset = zipBuffer.byteLength - 22;
  while (eocdOffset >= 0) {
    if (view.getUint32(eocdOffset, true) === 0x06054b50) break;
    eocdOffset--;
  }
  if (eocdOffset < 0) throw new Error("Invalid ZIP file");

  const centralDirOffset = view.getUint32(eocdOffset + 16, true);
  const numEntries = view.getUint16(eocdOffset + 10, true);
  let offset = centralDirOffset;

  for (let i = 0; i < numEntries; i++) {
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraFieldLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const fileName = new TextDecoder().decode(uint8.subarray(offset + 46, offset + 46 + fileNameLength));

    if (!fileName.endsWith("/")) {
      const localFileNameLength = view.getUint16(localHeaderOffset + 26, true);
      const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
      const dataOffset = localHeaderOffset + 30 + localFileNameLength + localExtraLength;
      const compressionMethod = view.getUint16(offset + 10, true);

      if (compressionMethod === 0) {
        files.set(fileName, uint8.subarray(dataOffset, dataOffset + uncompressedSize));
      } else {
        try {
          const compressedData = uint8.subarray(dataOffset, dataOffset + compressedSize);
          const ds = new DecompressionStream("deflate-raw");
          const writer = ds.writable.getWriter();
          writer.write(compressedData);
          writer.close();
          const reader = ds.readable.getReader();
          const chunks: Uint8Array[] = [];
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
          }
          const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
          const result = new Uint8Array(totalLength);
          let pos = 0;
          for (const chunk of chunks) {
            result.set(chunk, pos);
            pos += chunk.length;
          }
          files.set(fileName, result);
        } catch { /* skip */ }
      }
    }
    offset += 46 + fileNameLength + extraFieldLength + commentLength;
  }
  return files;
}

async function sha256(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function deployPages(
  token: string,
  accountId: string,
  name: string,
  zipBuffer: ArrayBuffer
): Promise<{ success: boolean; error?: string }> {
  const files = await extractZipFiles(zipBuffer);
  if (files.size === 0) return { success: false, error: "No files in ZIP" };

  const manifest: Record<string, { hash: string; size: number }> = [];
  const fileParts: Array<{ hash: string; data: Uint8Array }> = [];

  for (const [path, data] of files) {
    const hash = await sha256(data);
    manifest[path] = { hash, size: data.length };
    fileParts.push({ hash, data });
  }

  const formData = new FormData();
  formData.append("manifest", JSON.stringify(manifest));
  for (const { hash, data } of fileParts) {
    formData.append(hash, new Blob([data]), hash);
  }

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${name}/deployments`,
    { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData }
  );

  const data = await res.json<{ success: boolean; errors?: Array<{ message: string }> }>();
  if (!data.success) return { success: false, error: data.errors?.[0]?.message || "Pages deploy failed" };
  return { success: true };
}

async function deployWorker(
  token: string,
  accountId: string,
  name: string,
  zipBuffer: ArrayBuffer
): Promise<{ success: boolean; error?: string }> {
  const formData = new FormData();
  formData.append("metadata", new Blob([JSON.stringify({
    main_module: "worker.js",
    compatibility_date: new Date().toISOString().split("T")[0],
  })], { type: "application/json" }));
  formData.append("worker.js", new Blob([zipBuffer], { type: "application/javascript+module" }), "worker.js");

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/workers/${name}`,
    { method: "PUT", headers: { Authorization: `Bearer ${token}` }, body: formData }
  );

  const data = await res.json<{ success: boolean; errors?: Array<{ message: string }> }>();
  if (!data.success) return { success: false, error: data.errors?.[0]?.message || "Worker deploy failed" };
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
        ? await deployPages(token, accountId, name, zipBuffer)
        : await deployWorker(token, accountId, name, zipBuffer);
      results.push({ name, ...result });
    } catch (err) {
      results.push({ name, success: false, error: (err as Error).message || "Deploy failed" });
    }
  }

  return new Response(JSON.stringify({ results }), { status: 200, headers: { "Content-Type": "application/json" } });
};
