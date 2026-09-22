/**
 * POST /api/accounts/:id/pages/:name/deploy - Deploy ZIP to Pages project
 * 
 * Cloudflare Pages Direct Upload API requires:
 * 1. A manifest field with JSON mapping file paths to {hash, size}
 * 2. Each file uploaded as a separate part with its hash as the key
 */

import { getCloudflareToken } from "../../../../../lib/cloudflare";

interface Env {
  TOOL_DATA: KVNamespace;
}

// Simple ZIP file extraction - reads central directory and extracts files
async function extractZipFiles(zipBuffer: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const files = new Map<string, Uint8Array>();
  const view = new DataView(zipBuffer);
  const uint8 = new Uint8Array(zipBuffer);

  // Find End of Central Directory record
  let eocdOffset = zipBuffer.byteLength - 22;
  while (eocdOffset >= 0) {
    if (view.getUint32(eocdOffset, true) === 0x06054b50) break;
    eocdOffset--;
  }

  if (eocdOffset < 0) {
    throw new Error("Invalid ZIP file");
  }

  const centralDirOffset = view.getUint32(eocdOffset + 16, true);
  const numEntries = view.getUint16(eocdOffset + 10, true);

  let offset = centralDirOffset;

  for (let i = 0; i < numEntries; i++) {
    // Central Directory entry
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraFieldLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);

    const fileName = new TextDecoder().decode(
      uint8.subarray(offset + 46, offset + 46 + fileNameLength)
    );

    // Skip directories
    if (!fileName.endsWith("/")) {
      // Local file header
      const localFileNameLength = view.getUint16(localHeaderOffset + 26, true);
      const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
      const dataOffset = localHeaderOffset + 30 + localFileNameLength + localExtraLength;

      // Extract file data (assuming stored/no compression for simplicity)
      const compressionMethod = view.getUint16(offset + 10, true);
      if (compressionMethod === 0) {
        // Stored (no compression)
        files.set(fileName, uint8.subarray(dataOffset, dataOffset + uncompressedSize));
      } else {
        // Deflated - use DecompressionStream if available
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
        } catch {
          // Skip files that can't be decompressed
        }
      }
    }

    offset += 46 + fileNameLength + extraFieldLength + commentLength;
  }

  return files;
}

// Calculate SHA-256 hash of data
async function sha256(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray).map(b => b.toString(16).padStart(2, "0")).join("");
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

  const formData = await request.formData();
  const file = formData.get("files") as File | null;

  if (!file) {
    return new Response(
      JSON.stringify({ error: "No file provided" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const zipBuffer = await file.arrayBuffer();
    const files = await extractZipFiles(zipBuffer);

    if (files.size === 0) {
      return new Response(
        JSON.stringify({ error: "No files found in ZIP" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Build manifest and prepare file uploads
    const manifest: Record<string, { hash: string; size: number }> = {};
    const fileParts: Array<{ hash: string; data: Uint8Array }> = [];

    for (const [path, data] of files) {
      const hash = await sha256(data);
      manifest[path] = { hash, size: data.length };
      fileParts.push({ hash, data });
    }

    // Create multipart form data for Cloudflare API
    const uploadFormData = new FormData();
    uploadFormData.append("manifest", JSON.stringify(manifest));

    // Add each file with its hash as the key
    for (const { hash, data } of fileParts) {
      uploadFormData.append(hash, new Blob([data]), hash);
    }

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}/deployments`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: uploadFormData,
      }
    );

    const data = await response.json<{ success: boolean; errors?: Array<{ message: string }>; result?: { id: string; url: string } }>();

    if (!data.success) {
      return new Response(
        JSON.stringify({
          error: data.errors?.[0]?.message || "Failed to deploy Pages project",
        }),
        { status: response.status, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        deployment: data.result 
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Deploy failed: ${err instanceof Error ? err.message : String(err)}` }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
