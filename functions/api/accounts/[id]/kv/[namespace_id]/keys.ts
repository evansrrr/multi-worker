/**
 * GET /api/accounts/:id/kv/:namespace_id/keys - List keys in namespace
 *
 * 查询参数：
 *  - prefix: 键名前缀过滤（KV.md 中 List a Namespace's Keys 的 prefix 参数）
 *  - limit:  单页条数
 *  - cursor: 上一页返回的游标
 *
 * prefix 与 cursor 的关系：cursor 只是不透明的分页游标，不携带 prefix，
 * 因此翻页时每一页都必须同时带上同一个 prefix，否则后续页会退化为全量列表。
 */

import {
  getCloudflareToken,
  cloudflareFetch,
  parseCfResponse,
} from "../../../../../lib/cloudflare";

interface Env {
  TOOL_DATA: KVNamespace;
}

export interface KvKey {
  name: string;
  expiration?: number;
  metadata?: unknown;
}

interface KvListResultInfo {
  count?: number;
  cursor?: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context;
  const accountId = params.id as string;
  const namespaceId = params.namespace_id as string;

  const token = await getCloudflareToken(env, accountId);
  if (!token) {
    return new Response(
      JSON.stringify({ error: "Account not found or token invalid" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const url = new URL(context.request.url);
  const rawLimit = url.searchParams.get("limit");
  // CF 的 limit 上限是 1000，超出会被拒绝；这里夹取后透传。
  const limit = Math.min(Math.max(Number(rawLimit) || 1000, 1), 1000);
  const cursor = url.searchParams.get("cursor") || undefined;
  const prefix = url.searchParams.get("prefix") || undefined;

  const path =
    `/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/keys` +
    `?limit=${limit}` +
    (prefix ? `&prefix=${encodeURIComponent(prefix)}` : "") +
    (cursor ? `&cursor=${encodeURIComponent(cursor)}` : "");

  const response = await cloudflareFetch(token, path);

  const data = await parseCfResponse<KvKey[]>(response);

  if (!data.success) {
    const errorMessage =
      data.errors?.[0]?.message || "Failed to list KV keys";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  // Cloudflare returns { result: Key[], result_info: { count, cursor } }.
  // Normalize to { keys, cursor, list_complete } so the frontend can page.
  const anyData = data as unknown as { result_info?: KvListResultInfo };
  const resultInfo = anyData.result_info ?? {};
  return new Response(
    JSON.stringify({
      keys: data.result ?? [],
      cursor: resultInfo.cursor,
      list_complete: !resultInfo.cursor,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
