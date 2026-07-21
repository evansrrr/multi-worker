/**
 * GET /api/accounts/:id/d1 - List D1 databases
 * POST /api/accounts/:id/d1 - Create D1 database
 */

import {
  getCloudflareToken,
  cloudflareFetch,
  parseCfResponse,
} from "../../../../lib/cloudflare";

interface Env {
  TOOL_DATA: KVNamespace;
}

export interface D1Database {
  uuid: string;
  name: string;
  created_at?: string;
  jurisdiction?: "eu" | "fedramp";
  version?: string;
  num_tables?: number;
  file_size?: number;
  read_replication?: { mode: "auto" | "disabled" };
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

  const url = new URL(context.request.url);
  const name = url.searchParams.get("name") || undefined;
  const page = url.searchParams.get("page") || undefined;
  const perPage = url.searchParams.get("per_page") || undefined;

  let path = `/accounts/${accountId}/d1/database?`;
  if (name) path += `name=${encodeURIComponent(name)}&`;
  if (page) path += `page=${page}&`;
  if (perPage) path += `per_page=${perPage}&`;
  path = path.replace(/[&?]$/, "");

  const response = await cloudflareFetch(token, path);

  const data = await parseCfResponse<D1Database[]>(response);

  if (!data.success) {
    const errorMessage =
      data.errors?.[0]?.message || "Failed to list D1 databases";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ databases: data.result, result_info: (data as any).result_info }),
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

  const body = await context.request.json<{
    name: string;
    jurisdiction?: "eu" | "fedramp";
    primary_location_hint?: "wnam" | "enam" | "weur" | "eeur" | "apac" | "oc";
  }>();

  if (!body.name) {
    return new Response(
      JSON.stringify({ error: "Database name is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const response = await cloudflareFetch(
    token,
    `/accounts/${accountId}/d1/database`,
    {
      method: "POST",
      body: JSON.stringify({
        name: body.name,
        jurisdiction: body.jurisdiction,
        primary_location_hint: body.primary_location_hint,
      }),
    }
  );

  const data = await parseCfResponse<D1Database>(response);

  if (!data.success) {
    const errorMessage =
      data.errors?.[0]?.message || "Failed to create D1 database";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ database: data.result }),
    { status: 201, headers: { "Content-Type": "application/json" } }
  );
};
