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
  size: string;
  expiration?: number;
  metadata?: Record<string, string>;
}

export interface KvKeysList {
  keys: KvKey[];
  list_complete: boolean;
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

  let path = `/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/keys?limit=${limit}`;
  if (cursor) {
    path += `&cursor=${cursor}`;
  }

  const response = await cloudflareFetch(token, path);

  const data = await parseCfResponse<KvKeysList>(response);

  if (!data.success) {
    const errorMessage =
      data.errors?.[0]?.message || "Failed to list KV keys";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify(data.result),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
