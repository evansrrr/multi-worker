/**
 * GET /api/accounts/:id/workers - List workers (paginated)
 * POST /api/accounts/:id/workers - Create worker
 */

import {
  getCloudflareToken,
  cloudflareFetch,
  parseCfResponse,
} from "../../../../lib/cloudflare";

interface Env {
  TOOL_DATA: KVNamespace;
}

export interface Worker {
  id: string;
  name: string;
  created_on: string;
  updated_on: string;
  deployed_on?: string;
  logpush: boolean;
  subdomain: {
    enabled: boolean;
    previews_enabled: boolean;
  };
  tags: string[];
}

export interface ResultInfo {
  count?: number;
  page?: number;
  per_page?: number;
  total_count?: number;
  cursor?: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context;
  const accountId = params.id as string;

  const token = await getCloudflareToken(env, accountId);
  if (!token) {
    return new Response(
      JSON.stringify({ error: "Account not found or token invalid" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const url = new URL(request.url);
  const page = url.searchParams.get("page") ?? "1";
  const perPage = url.searchParams.get("per_page") ?? "20";

  const response = await cloudflareFetch(
    token,
    `/accounts/${accountId}/workers/workers?page=${encodeURIComponent(
      page
    )}&per_page=${encodeURIComponent(perPage)}`
  );

  const data = await parseCfResponse<Worker[]>(response);

  if (!data.success) {
    const errorMessage = data.errors?.[0]?.message || "Failed to list workers";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  // Cloudflare puts pagination info in result_info alongside result.
  const anyData = data as unknown as { result_info?: ResultInfo };
  return new Response(
    JSON.stringify({ workers: data.result, result_info: anyData.result_info }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, params } = context;
  const accountId = params.id as string;

  const token = await getCloudflareToken(env, accountId);
  if (!token) {
    return new Response(
      JSON.stringify({ error: "Account not found or token invalid" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const body = await context.request.json<{ name: string; script?: string }>();
  if (!body.name) {
    return new Response(
      JSON.stringify({ error: "Worker name is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Step 1: create the Worker entity via the Beta JSON endpoint. This only
  // registers the Worker — it does NOT upload code. The classic scripts
  // endpoint is the only way to upload a module.
  const createRes = await cloudflareFetch(
    token,
    `/accounts/${accountId}/workers/workers`,
    {
      method: "POST",
      body: JSON.stringify({ name: body.name }),
    }
  );
  const createData = await parseCfResponse<Worker>(createRes);
  if (!createData.success) {
    const errorMessage =
      createData.errors?.[0]?.message || "Failed to create worker";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  // Step 2: upload the initial script via the classic multipart upload
  // endpoint. Do NOT set Content-Type manually — fetch generates the
  // multipart boundary.
  const metadata = {
    main_module: "worker.js",
    compatibility_date: new Date().toISOString().split("T")[0],
  };

  const formData = new FormData();
  formData.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" })
  );

  const script =
    body.script ||
    `export default {
  async fetch(request) {
    return new Response("Hello from ${body.name}!");
  },
};`;
  formData.append(
    "worker.js",
    new Blob([script], { type: "application/javascript+module" }),
    "worker.js"
  );

  const uploadRes = await cloudflareFetch(
    token,
    `/accounts/${accountId}/workers/scripts/${encodeURIComponent(body.name)}`,
    {
      method: "PUT",
      body: formData,
    }
  );
  const uploadData = await parseCfResponse(uploadRes);
  if (!uploadData.success) {
    // Roll back the entity so a half-created Worker doesn't linger.
    await cloudflareFetch(
      token,
      `/accounts/${accountId}/workers/workers/${encodeURIComponent(body.name)}`,
      { method: "DELETE" }
    ).catch(() => {});
    const errorMessage =
      uploadData.errors?.[0]?.message || "Failed to upload worker script";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ worker: createData.result }),
    { status: 201, headers: { "Content-Type": "application/json" } }
  );
};
