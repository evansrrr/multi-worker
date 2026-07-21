/**
 * GET /api/accounts/:id/d1/:database_id/tables - List tables in D1 database
 */

import {
  getCloudflareToken,
  cloudflareFetch,
  parseCfResponse,
} from "../../../../../lib/cloudflare";

interface Env {
  TOOL_DATA: KVNamespace;
}

interface D1QueryMeta {
  changed_db?: boolean;
  changes?: number;
  duration?: number;
  last_row_id?: number;
  rows_read?: number;
  rows_written?: number;
  served_by_colo?: string;
  served_by_primary?: boolean;
  served_by_region?: string;
  size_after?: number;
  timings?: { sql_duration_ms?: number };
}

interface D1QueryResult {
  meta?: D1QueryMeta;
  results?: Array<{ name: string; type: string }>;
  success?: boolean;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context;
  const accountId = params.id as string;
  const databaseId = params.database_id as string;

  const token = await getCloudflareToken(env, accountId);
  if (!token) {
    return new Response(
      JSON.stringify({ error: "Account not found or token invalid" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const response = await cloudflareFetch(
    token,
    `/accounts/${accountId}/d1/database/${databaseId}/query`,
    {
      method: "POST",
      body: JSON.stringify({
        sql: "SELECT name, type FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;",
      }),
    }
  );

  const data = await parseCfResponse<D1QueryResult[]>(response);

  if (!data.success) {
    const errorMessage =
      data.errors?.[0]?.message || "Failed to list tables";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  const tables = data.result?.[0]?.results || [];

  return new Response(
    JSON.stringify({ tables }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
