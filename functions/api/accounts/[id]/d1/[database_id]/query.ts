/**
 * POST /api/accounts/:id/d1/:database_id/query - Execute SQL query on D1 database
 *
 * 请求体（D1.md「Query D1 Database」）：
 *   { sql, params? }            单条语句，params 为绑定参数数组
 *   { batch: [{ sql, params? }] } 多条语句
 *
 * params 会原样透传给 D1 的参数化 API，值只接受 string / number / boolean / null，
 * 前端因此可以安全地传参而不必拼接 SQL（避免注入）。
 * 注意：多语句（分号分隔）时 params 会按顺序绑定到整批语句的占位符上，
 * 因此带参数的查询建议只写一条语句。
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
  errors?: Array<{ code?: number; message?: string }>;
  /** D1 在语句级失败时可能直接用字符串 error 字段（见 AUDIT M6）。 */
  error?: string;
}

/** D1 绑定参数允许的类型（JSON 可序列化的标量）。 */
type SqlParam = string | number | boolean | null;

interface StatementError {
  index: number;
  error: string;
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * 校验绑定参数：只接受标量，拒绝对象/数组/undefined，
 * 否则 D1 会拒绝整个请求且报错信息对前端不友好。
 */
function normalizeParams(
  raw: unknown,
  label: string
): SqlParam[] | { error: string } {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    return { error: `${label} params must be an array` };
  }
  const params: SqlParam[] = [];
  for (let i = 0; i < raw.length; i++) {
    const value = raw[i];
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null
    ) {
      params.push(value);
    } else {
      return { error: `${label} params[${i}] must be string, number, boolean or null` };
    }
  }
  return params;
}

/**
 * 抽取单条语句的错误：D1 的外层 success 保持 true，失败信息落在
 * result[i].success === false 上，可能是 errors[].message 或 error 字符串。
 */
function statementError(result: D1QueryResult | undefined): string | undefined {
  if (!result) return undefined;
  if (result.success === false || (result.errors?.length ?? 0) > 0) {
    return (
      result.errors?.[0]?.message ||
      result.error ||
      "Statement execution failed"
    );
  }
  return undefined;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, params } = context;
  const accountId = params.id as string;
  const databaseId = params.database_id as string;

  const token = await getCloudflareToken(env, accountId);
  if (!token) {
    return jsonError("Account not found or token invalid", 404);
  }

  const body = await context.request.json<{
    sql?: string;
    params?: unknown;
    batch?: Array<{ sql?: string; params?: unknown }>;
  }>();

  // Support both single query and batch query
  let queryBody: object;
  if (body.batch !== undefined) {
    if (!Array.isArray(body.batch) || body.batch.length === 0) {
      return jsonError("batch must be a non-empty array", 400);
    }
    const batch: Array<{ sql: string; params?: SqlParam[] }> = [];
    for (let i = 0; i < body.batch.length; i++) {
      const item = body.batch[i];
      if (!item || typeof item.sql !== "string" || item.sql.trim() === "") {
        return jsonError(`batch[${i}] is missing "sql"`, 400);
      }
      const itemParams = normalizeParams(item.params, `batch[${i}]`);
      if (!Array.isArray(itemParams)) {
        return jsonError(itemParams.error, 400);
      }
      const entry: { sql: string; params?: SqlParam[] } = { sql: item.sql };
      if (itemParams.length > 0) entry.params = itemParams;
      batch.push(entry);
    }
    queryBody = { batch };
  } else if (body.sql && body.sql.trim() !== "") {
    const singleParams = normalizeParams(body.params, "query");
    if (!Array.isArray(singleParams)) {
      return jsonError(singleParams.error, 400);
    }
    const single: { sql: string; params?: SqlParam[] } = { sql: body.sql };
    if (singleParams.length > 0) single.params = singleParams;
    queryBody = single;
  } else {
    return jsonError("SQL query or batch is required", 400);
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
    return jsonError(errorMessage, 502);
  }

  // D1 wraps each statement's outcome in result[i].success; the outer
  // success stays true even when individual statements fail. Surface
  // per-statement errors so the UI can show them.
  const results = data.result ?? [];
  const perStatementErrors: StatementError[] = [];
  results.forEach((r, i) => {
    const message = statementError(r);
    if (message) perStatementErrors.push({ index: i, error: message });
  });

  return new Response(
    JSON.stringify({
      result: results,
      statement_errors: perStatementErrors,
      // 前端据此决定是否显示错误态，避免只看 results.length 误判为"执行成功"
      success: perStatementErrors.length === 0,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
