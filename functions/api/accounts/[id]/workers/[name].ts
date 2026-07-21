/**
 * GET /api/accounts/:id/workers/:name - Get worker details
 * DELETE /api/accounts/:id/workers/:name - Delete worker
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
  routes: Array<{
    pattern: string;
    zone_id: string;
    zone_name: string;
    priority: number;
  }>;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context;
  const accountId = params.id as string;
  const workerName = params.name as string;

  const token = await getCloudflareToken(env, accountId);
  if (!token) {
    return new Response(
      JSON.stringify({ error: "Account not found or token invalid" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const response = await cloudflareFetch(
    token,
    `/accounts/${accountId}/workers/workers/${workerName}`
  );

  const data = await parseCfResponse<Worker>(response);

  if (!data.success) {
    const errorMessage =
      data.errors?.[0]?.message || "Failed to get worker details";
    const status = response.status === 404 ? 404 : 502;
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ worker: data.result }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { env, params } = context;
  const accountId = params.id as string;
  const workerName = params.name as string;

  const token = await getCloudflareToken(env, accountId);
  if (!token) {
    return new Response(
      JSON.stringify({ error: "Account not found or token invalid" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const response = await cloudflareFetch(
    token,
    `/accounts/${accountId}/workers/workers/${workerName}`,
    {
      method: "DELETE",
    }
  );

  const data = await parseCfResponse<{ id: string }>(response);

  if (!data.success) {
    const errorMessage = data.errors?.[0]?.message || "Failed to delete worker";
    const status = response.status === 404 ? 404 : 502;
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, name: workerName }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
