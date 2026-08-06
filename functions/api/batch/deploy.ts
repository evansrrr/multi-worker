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

async function deployPages(
  token: string,
  accountId: string,
  name: string,
  zipBuffer: ArrayBuffer
): Promise<{ success: boolean; error?: string }> {
  const formData = new FormData();
  formData.append(
    "manifest",
    JSON.stringify({ "/": { "contentType": "application/zip" } })
  );
  formData.append(
    "files",
    new Blob([zipBuffer], { type: "application/zip" }),
    "deploy.zip"
  );

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${name}/deployments`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    }
  );

  const data = await res.json<{ success: boolean; errors?: Array<{ message: string }> }>();

  if (!data.success) {
    return { success: false, error: data.errors?.[0]?.message || "Pages deploy failed" };
  }
  return { success: true };
}

async function deployWorker(
  token: string,
  accountId: string,
  name: string,
  zipBuffer: ArrayBuffer
): Promise<{ success: boolean; error?: string }> {
  const formData = new FormData();
  formData.append(
    "metadata",
    new Blob(
      [
        JSON.stringify({
          main_module: "worker.js",
          compatibility_date: new Date().toISOString().split("T")[0],
        }),
      ],
      { type: "application/json" }
    )
  );
  formData.append(
    "worker.js",
    new Blob([zipBuffer], { type: "application/javascript+module" }),
    "worker.js"
  );

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/workers/${name}`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    }
  );

  const data = await res.json<{ success: boolean; errors?: Array<{ message: string }> }>();

  if (!data.success) {
    return { success: false, error: data.errors?.[0]?.message || "Worker deploy failed" };
  }
  return { success: true };
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env } = context;

  let formData: FormData;
  try {
    formData = await context.request.formData();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid form data" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const file = formData.get("files");
  if (!file || !(file instanceof File)) {
    return new Response(
      JSON.stringify({ error: "files field is required and must be a ZIP file" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const targetsRaw = formData.get("targets");
  if (!targetsRaw || typeof targetsRaw !== "string") {
    return new Response(
      JSON.stringify({ error: "targets field is required and must be a JSON string" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  let targets: BatchTarget[];
  try {
    targets = JSON.parse(targetsRaw);
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid targets JSON" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!Array.isArray(targets) || targets.length === 0) {
    return new Response(
      JSON.stringify({ error: "targets array must not be empty" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const zipBuffer = await file.arrayBuffer();
  const results: BatchResult[] = [];

  for (const target of targets) {
    const { accountId, name, type } = target;

    if (!accountId || !name || !type) {
      results.push({ name: name || "unknown", success: false, error: "Missing required fields" });
      continue;
    }

    if (type !== "worker" && type !== "pages") {
      results.push({ name, success: false, error: `Invalid type: ${type}` });
      continue;
    }

    const token = await getCloudflareToken(env, accountId);
    if (!token) {
      results.push({ name, success: false, error: "Account not found or token invalid" });
      continue;
    }

    try {
      const result =
        type === "pages"
          ? await deployPages(token, accountId, name, zipBuffer)
          : await deployWorker(token, accountId, name, zipBuffer);

      results.push({ name, ...result });
    } catch (err) {
      results.push({ name, success: false, error: (err as Error).message || "Deploy failed" });
    }
  }

  return new Response(
    JSON.stringify({ results }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
