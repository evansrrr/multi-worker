/**
 * GET /api/accounts/:id/kv/:namespace_id/keys - List keys in namespace
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
  const limit = url.searchParams.get("limit") || "1000";
  const cursor = url.searchParams.get("cursor") || undefined;

  const path =
    `/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/keys` +
    `?limit=${encodeURIComponent(limit)}` +
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
