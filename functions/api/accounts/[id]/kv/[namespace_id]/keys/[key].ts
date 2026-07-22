/**
 * GET /api/accounts/:id/kv/:namespace_id/keys/:key - Get value for key
 * PUT /api/accounts/:id/kv/:namespace_id/keys/:key - Set value for key
 * DELETE /api/accounts/:id/kv/:namespace_id/keys/:key - Delete key
 */

import {
  getCloudflareToken,
  cloudflareFetch,
} from "../../../../../../lib/cloudflare";

interface Env {
  TOOL_DATA: KVNamespace;
}

export interface KvSetValue {
  success: boolean;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context;
  const accountId = params.id as string;
  const namespaceId = params.namespace_id as string;
  const key = params.key as string;

  const token = await getCloudflareToken(env, accountId);
  if (!token) {
    return new Response(
      JSON.stringify({ error: "Account not found or token invalid" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const response = await cloudflareFetch(
    token,
    `/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${key}`
  );

  if (response.status === 404) {
    return new Response(
      JSON.stringify({ error: "Key not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!response.ok) {
    const errorData = await response.json<{
      errors?: Array<{ message: string }>;
    }>();
    const errorMessage =
      errorData.errors?.[0]?.message || "Failed to get KV value";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  const value = await response.text();

  return new Response(
    JSON.stringify({ key, value }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { env, params } = context;
  const accountId = params.id as string;
  const namespaceId = params.namespace_id as string;
  const key = params.key as string;

  const token = await getCloudflareToken(env, accountId);
  if (!token) {
    return new Response(
      JSON.stringify({ error: "Account not found or token invalid" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const body = await context.request.json<{
    value: string;
    expiration?: number;
    expiration_ttl?: number;
    metadata?: Record<string, string>;
  }>();

  if (body.value === undefined) {
    return new Response(
      JSON.stringify({ error: "Value is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Cloudflare KV PUT uses form data
  const formData = new FormData();
  formData.append("value", body.value);

  if (body.expiration) {
    formData.append("expiration", body.expiration.toString());
  }
  if (body.expiration_ttl) {
    formData.append("expiration_ttl", body.expiration_ttl.toString());
  }
  if (body.metadata) {
    formData.append("metadata", JSON.stringify(body.metadata));
  }

  const response = await cloudflareFetch(
    token,
    `/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${key}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "multipart/form-data",
      },
      body: formData,
    }
  );

  if (!response.ok) {
    const errorData = await response.json<{
      errors?: Array<{ message: string }>;
    }>();
    const errorMessage =
      errorData.errors?.[0]?.message || "Failed to set KV value";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { env, params } = context;
  const accountId = params.id as string;
  const namespaceId = params.namespace_id as string;
  const key = params.key as string;

  const token = await getCloudflareToken(env, accountId);
  if (!token) {
    return new Response(
      JSON.stringify({ error: "Account not found or token invalid" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const response = await cloudflareFetch(
    token,
    `/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${key}`,
    {
      method: "DELETE",
    }
  );

  if (!response.ok) {
    const errorData = await response.json<{
      errors?: Array<{ message: string }>;
    }>();
    const errorMessage =
      errorData.errors?.[0]?.message || "Failed to delete KV key";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
