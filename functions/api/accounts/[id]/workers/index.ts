/**
 * GET /api/accounts/:id/workers - List workers
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
  logpush: boolean;
  subdomain: {
    enabled: boolean;
    previews_enabled: boolean;
  };
  tags: string[];
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context;
  const accountId = params.id as string;

  const token = await getCloudflareToken(env, accountId);
  if (!token) {
    return new Response(
      JSON.stringify({ error: "Account not found or token invalid" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const response = await cloudflareFetch(
    token,
    `/accounts/${accountId}/workers/workers`
  );

  const data = await parseCfResponse<Worker[]>(response);

  if (!data.success) {
    const errorMessage = data.errors?.[0]?.message || "Failed to list workers";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ workers: data.result }),
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

  // Create worker metadata
  const metadata = {
    main_module: "worker.js",
    compatibility_date: new Date().toISOString().split("T")[0],
  };

  // Create multipart form data
  const formData = new FormData();
  formData.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" })
  );

  // Use provided script or default
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

  const response = await cloudflareFetch(
    token,
    `/accounts/${accountId}/workers/workers`,
    {
      method: "POST",
      headers: {
        "Content-Type": "multipart/form-data",
      },
      body: formData,
    }
  );

  const data = await parseCfResponse<Worker>(response);

  if (!data.success) {
    const errorMessage =
      data.errors?.[0]?.message || "Failed to create worker";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ worker: data.result }),
    { status: 201, headers: { "Content-Type": "application/json" } }
  );
};
