/**
 * GET /api/accounts/:id/d1/:database_id/tables - List schema objects in D1 database
 *
 * D1 底层是 SQLite，schema 信息都能从系统表 sqlite_master 读到（type 列区分
 * table / view / index / trigger，tbl_name 给出索引与触发器归属的表）。
 * 因此这里不再只查 type='table'，而是把四类对象都取回来并分类返回：
 *   { tables: [...], views: [...], indexes: [...], triggers: [...] }
 * 每项形如 { name, type, kind, tbl_name, sql }，kind 是归一化后的
 * table|view|index|trigger，前端可直接按 kind 分组展示。
 * `tables` 仍只含表，保持与旧版前端的兼容。
 */

import {
  getCloudflareToken,
  cloudflareFetch,
  parseCfResponse,
} from "../../../../../lib/cloudflare";

interface Env {
  TOOL_DATA: KVNamespace;
}

/** sqlite_master 里需要排除的内置对象前缀（含 sqlite_autoindex_*）。 */
const SQLITE_INTERNAL_PREFIX = "sqlite_%";

const SCHEMA_SQL =
  `SELECT name, type, tbl_name, sql FROM sqlite_master ` +
  `WHERE type IN ('table', 'view', 'index', 'trigger') ` +
  `AND name NOT LIKE '${SQLITE_INTERNAL_PREFIX}' ` +
  `ORDER BY name;`;

interface D1QueryResult {
  meta?: Record<string, unknown>;
  results?: Array<{
    name?: string;
    type?: string;
    tbl_name?: string;
    sql?: string | null;
  }>;
  success?: boolean;
  errors?: Array<{ code?: number; message?: string }>;
  error?: string;
}

type SchemaKind = "table" | "view" | "index" | "trigger" | "other";

interface SchemaObject {
  name: string;
  /** sqlite_master 的原始 type */
  type: string;
  /** 归一化后的对象类型，供前端分类展示 */
  kind: SchemaKind;
  /** 索引/触发器所属的表，表与视图等于自身 */
  tbl_name: string;
  /** 建对象用的 DDL，可能为 null */
  sql: string | null;
}

const KNOWN_KINDS: Record<string, SchemaKind> = {
  table: "table",
  view: "view",
  index: "index",
  trigger: "trigger",
};

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function toSchemaObject(row: {
  name?: string;
  type?: string;
  tbl_name?: string;
  sql?: string | null;
}): SchemaObject {
  const name = String(row.name ?? "");
  const rawType = String(row.type ?? "").toLowerCase();
  return {
    name,
    type: rawType,
    kind: KNOWN_KINDS[rawType] ?? "other",
    tbl_name: String(row.tbl_name ?? name),
    sql: row.sql ?? null,
  };
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context;
  const accountId = params.id as string;
  const databaseId = params.database_id as string;

  const token = await getCloudflareToken(env, accountId);
  if (!token) {
    return jsonError("Account not found or token invalid", 404);
  }

  const response = await cloudflareFetch(
    token,
    `/accounts/${accountId}/d1/database/${databaseId}/query`,
    {
      method: "POST",
      body: JSON.stringify({ sql: SCHEMA_SQL }),
    }
  );

  const data = await parseCfResponse<D1QueryResult[]>(response);

  if (!data.success) {
    const errorMessage =
      data.errors?.[0]?.message || "Failed to list tables";
    return jsonError(errorMessage, 502);
  }

  // D1 wraps the statement's own outcome in result[0].success; the outer
  // success can still be true even when the statement itself failed.
  const stmt = data.result?.[0];
  if (stmt && stmt.success === false) {
    const errorMessage =
      stmt.errors?.[0]?.message || stmt.error || "Failed to list tables";
    return jsonError(errorMessage, 502);
  }

  const objects = (stmt?.results ?? []).map(toSchemaObject);

  return new Response(
    JSON.stringify({
      tables: objects.filter((o) => o.kind === "table"),
      views: objects.filter((o) => o.kind === "view"),
      indexes: objects.filter((o) => o.kind === "index"),
      triggers: objects.filter((o) => o.kind === "trigger"),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
