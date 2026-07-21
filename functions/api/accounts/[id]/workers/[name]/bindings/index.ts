/**
 * GET /api/accounts/:id/workers/:name/bindings - Get worker bindings
 * PUT /api/accounts/:id/workers/:name/bindings - Update worker bindings
 */

import {
  getCloudflareToken,
  cloudflareFetch,
  parseCfResponse,
} from "../../../../../lib/cloudflare";

interface Env {
  TOOL_DATA: KVNamespace;
}

export interface Binding {
  name: string;
  type: string;
  [key: string]: unknown;
}

interface ScriptSettings {
  bindings?: Binding[];
  [key: string]: unknown;
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
    `/accounts/${accountId}/workers/scripts/${workerName}/settings`
  );

  const data = await parseCfResponse<ScriptSettings>(response);

  if (!data.success) {
    const errorMessage =
      data.errors?.[0]?.message || "Failed to get worker bindings";
    const status = response.status === 404 ? 404 : 502;
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ bindings: data.result?.bindings || [] }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
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

  const body = await context.request.json<{ bindings: Binding[] }>();

  if (!body.bindings || !Array.isArray(body.bindings)) {
    return new Response(
      JSON.stringify({ error: "Bindings array is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const response = await cloudflareFetch(
    token,
    `/accounts/${accountId}/workers/scripts/${workerName}/settings`,
    {
      method: "PATCH",
      body: JSON.stringify({
        bindings: body.bindings,
      }),
    }
  );

  const data = await parseCfResponse<ScriptSettings>(response);

  if (!data.success) {
    const errorMessage =
      data.errors?.[0]?.message || "Failed to update worker bindings";
    const status = response.status === 404 ? 404 : 502;
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ bindings: data.result?.bindings || [] }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
