/**
 * POST /api/accounts/:id/d1/:database_id/query - Execute SQL query on D1 database
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
  results?: unknown[];
  success?: boolean;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
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

  const body = await context.request.json<{
    sql?: string;
    params?: string[];
    batch?: Array<{ sql: string; params?: string[] }>;
  }>();

  // Support both single query and batch query
  let queryBody: object;
  if (body.batch) {
    queryBody = { batch: body.batch };
  } else if (body.sql) {
    queryBody = { sql: body.sql, params: body.params };
  } else {
    return new Response(
      JSON.stringify({ error: "SQL query or batch is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const response = await cloudflareFetch(
    token,
    `/accounts/${accountId}/d1/database/${databaseId}/query`,
    {
      method: "POST",
      body: JSON.stringify(queryBody),
    }
  );

  const data = await parseCfResponse<D1QueryResult[]>(response);

  if (!data.success) {
    const errorMessage =
      data.errors?.[0]?.message || "Failed to execute query";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ result: data.result }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
