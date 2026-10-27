/**
 * GET    /api/accounts/:id/kv/:namespace_id/keys/*key - 读取键值
 * PUT    /api/accounts/:id/kv/:namespace_id/keys/*key - 写入键值
 * DELETE /api/accounts/:id/kv/:namespace_id/keys/*key - 删除键
 *
 * 键名路由用 catch-all（[[key]]，Pages Functions 的多段路由语法），
 * 因此含 "/" 的键名也能命中；context.params.key 是多段数组。
 * 调用方必须把键名按 "/" 切段、每段 encodeURIComponent 后再用 "/" 拼接；
 * 整体 encodeURIComponent 会把 "/" 编码掉，CF 侧会拿到错误的键名。
 *
 * GET 支持 ?type=text|binary：
 *   - text（默认）：按字符串返回 value（与旧行为一致）
 *   - binary：返回 base64 编码的 value + 原始 Content-Type + metadata，
 *     避免 response.text() 损坏二进制内容
 * GET 支持 ?withMetadata=true 附带 metadata（binary 模式默认附带）。
 */

import {
  getCloudflareToken,
  cloudflareFetch,
  parseCfResponse,
} from "../../../../../../lib/cloudflare";

interface Env {
  TOOL_DATA: KVNamespace;
}

export interface KvSetValue {
  success: boolean;
}

/** binary 模式下单次可 base64 编码的最大字节数（超过直接报错，避免撑爆内存）。 */
const MAX_BINARY_BYTES = 10 * 1024 * 1024;

/** 把 catch-all 参数还原成键名分段（Pages Functions 已做过一次解码，此处不再解码）。 */
function keySegments(raw: string | string[] | undefined): string[] {
  const segments = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split("/")
      : [];
  return segments.filter((s) => s.length > 0);
}

/** 按段 encodeURIComponent 后用 "/" 拼接，交给 CF 的 values/metadata 端点。 */
function buildKeyPath(segments: string[]): string {
  return segments.map((s) => encodeURIComponent(s)).join("/");
}

/** 分块 base64 编码，避免一次展开过大数组导致爆栈。 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const CHUNK = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/** 读取键的 metadata（KV.md: GET .../metadata/{key_name}）。失败返回 null，不阻断主流程。 */
async function fetchMetadata(
  token: string,
  accountId: string,
  namespaceId: string,
  keyPath: string
): Promise<unknown> {
  try {
    const response = await cloudflareFetch(
      token,
      `/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/metadata/${keyPath}`
    );
    if (!response.ok) return null;
    const data = await parseCfResponse<unknown>(response);
    return data.result ?? null;
  } catch {
    return null;
  }
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context;
  const accountId = params.id as string;
  const namespaceId = params.namespace_id as string;
  const segments = keySegments(params.key as string | string[] | undefined);

  if (segments.length === 0) {
    return new Response(
      JSON.stringify({ error: "Key is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  const key = segments.join("/");
  const keyPath = buildKeyPath(segments);

  const token = await getCloudflareToken(env, accountId);
  if (!token) {
    return new Response(
      JSON.stringify({ error: "Account not found or token invalid" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const url = new URL(context.request.url);
  const asBinary = url.searchParams.get("type") === "binary";
  const withMetadata =
    asBinary || url.searchParams.get("withMetadata") === "true";

  const response = await cloudflareFetch(
    token,
    `/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${keyPath}`
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

  // KV.md：过期时间通过响应头 expiration 返回（秒级 UNIX 时间戳）。
  const expirationHeader = response.headers.get("expiration");
  const expiration =
    expirationHeader != null && expirationHeader !== ""
      ? Number(expirationHeader)
      : undefined;
  const contentType = response.headers.get("Content-Type") ?? undefined;
  const metadata = withMetadata
    ? await fetchMetadata(token, accountId, namespaceId, keyPath)
    : undefined;

  const base = {
    key,
    expiration: Number.isFinite(expiration) ? expiration : undefined,
    content_type: contentType,
    metadata,
  };

  if (asBinary) {
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_BINARY_BYTES) {
      return new Response(
        JSON.stringify({
          error: `Value too large to return as base64 (${buffer.byteLength} bytes, limit ${MAX_BINARY_BYTES})`,
        }),
        { status: 413, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response(
      JSON.stringify({
        ...base,
        value: arrayBufferToBase64(buffer),
        encoding: "base64",
        size: buffer.byteLength,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  const value = await response.text();
  return new Response(
    JSON.stringify({ ...base, value, encoding: "text" }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { env, params } = context;
  const accountId = params.id as string;
  const namespaceId = params.namespace_id as string;
  const segments = keySegments(params.key as string | string[] | undefined);

  if (segments.length === 0) {
    return new Response(
      JSON.stringify({ error: "Key is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  const keyPath = buildKeyPath(segments);

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
    metadata?: Record<string, unknown>;
  }>();

  if (body.value === undefined) {
    return new Response(
      JSON.stringify({ error: "Value is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const hasMetadata = body.metadata !== undefined;
  const hasExpiration = body.expiration !== undefined;
  const hasTtl = body.expiration_ttl !== undefined;

  let fetchBody: BodyInit;
  const extraHeaders: Record<string, string> = {};

  if (hasMetadata || hasExpiration || hasTtl) {
    // KV PUT uses multipart/form-data when metadata or expiration is set.
    const formData = new FormData();
    formData.append("value", body.value);
    if (hasExpiration) {
      formData.append("expiration", String(body.expiration));
    }
    if (hasTtl) {
      formData.append("expiration_ttl", String(body.expiration_ttl));
    }
    if (hasMetadata) {
      formData.append("metadata", JSON.stringify(body.metadata));
    }
    fetchBody = formData;
    // Do NOT set Content-Type — fetch must generate the multipart boundary.
  } else {
    // Plain value write: body is the raw value, no Content-Type header.
    fetchBody = body.value;
  }

  const response = await cloudflareFetch(
    token,
    `/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${keyPath}`,
    {
      method: "PUT",
      headers: extraHeaders,
      body: fetchBody,
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
  const segments = keySegments(params.key as string | string[] | undefined);

  if (segments.length === 0) {
    return new Response(
      JSON.stringify({ error: "Key is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  const keyPath = buildKeyPath(segments);

  const token = await getCloudflareToken(env, accountId);
  if (!token) {
    return new Response(
      JSON.stringify({ error: "Account not found or token invalid" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const response = await cloudflareFetch(
    token,
    `/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${keyPath}`,
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
