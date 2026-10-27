/**
 * PUT /api/accounts/:id/kv/:namespace_id/bulk - 批量导入键值对
 *
 * 转发到 CF 的 PUT /accounts/{account_id}/storage/kv/namespaces/{namespace_id}/bulk
 * （KV.md「Write multiple key-value pairs」）：
 *   - body 是 JSON 数组，每项 { key, value, base64?, expiration?, expiration_ttl?, metadata? }
 *   - 最多 10,000 条；整个请求体不得超过 100 MB
 *   - key 最长 512 字节；expiration_ttl 至少 60 秒
 *
 * 请求体支持三种形态：
 *   1) 裸数组                    [{ key, value }, ...]
 *   2) { pairs: [...] }
 *   3) { format: "csv", csv: "..." } —— 服务端解析 CSV（首行可为 key,value 表头）
 */

import {
  getCloudflareToken,
  cloudflareFetch,
  parseCfResponse,
} from "../../../../../lib/cloudflare";

interface Env {
  TOOL_DATA: KVNamespace;
}

/** KV.md：单次 bulk 写入最多 10,000 条。 */
const MAX_PAIRS = 10_000;
/** KV.md：整个请求体不得超过 100 MB。 */
const MAX_BODY_BYTES = 100 * 1024 * 1024;
/** KV.md：key 最长 512 字节。 */
const MAX_KEY_BYTES = 512;
/** KV.md：expiration_ttl 至少 60 秒。 */
const MIN_TTL_SECONDS = 60;

interface BulkPair {
  key: string;
  value: string;
  base64?: boolean;
  expiration?: number;
  expiration_ttl?: number;
  metadata?: unknown;
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

/** 极简 CSV 解析（支持引号包裹、"" 转义、CRLF、BOM），不引入任何依赖。 */
function parseCsvRows(input: string): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i += 1;
        }
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (ch === "\r") {
      i += 1;
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  row.push(field);
  rows.push(row);

  // 丢弃纯空行
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

function toOptionalNumber(raw: string | undefined): number | undefined {
  if (raw == null) return undefined;
  const trimmed = raw.trim();
  if (trimmed === "") return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

function toOptionalBool(raw: string | undefined): boolean | undefined {
  if (raw == null) return undefined;
  const trimmed = raw.trim().toLowerCase();
  if (trimmed === "" || trimmed === "false" || trimmed === "0") return false;
  if (trimmed === "true" || trimmed === "1") return true;
  return undefined;
}

function pairsFromCsv(csv: string): BulkPair[] {
  const rows = parseCsvRows(csv);
  if (rows.length === 0) return [];

  const header = rows[0].map((c) => c.trim().toLowerCase());
  const hasHeader = header.includes("key") && header.includes("value");
  const col = (name: string) => header.indexOf(name);
  const bodyRows = hasHeader ? rows.slice(1) : rows;

  const keyIdx = hasHeader ? col("key") : 0;
  const valueIdx = hasHeader ? col("value") : 1;
  const expirationIdx = hasHeader ? col("expiration") : -1;
  const ttlIdx = hasHeader ? col("expiration_ttl") : -1;
  const base64Idx = hasHeader ? col("base64") : -1;
  const metadataIdx = hasHeader ? col("metadata") : -1;

  const pairs: BulkPair[] = [];
  for (const row of bodyRows) {
    const key = (row[keyIdx] ?? "").trim();
    if (key === "") continue;
    const pair: BulkPair = { key, value: row[valueIdx] ?? "" };
    const expiration = toOptionalNumber(row[expirationIdx]);
    if (expiration !== undefined) pair.expiration = expiration;
    const ttl = toOptionalNumber(row[ttlIdx]);
    if (ttl !== undefined) pair.expiration_ttl = ttl;
    const base64 = toOptionalBool(row[base64Idx]);
    if (base64 !== undefined) pair.base64 = base64;
    const rawMetadata = metadataIdx >= 0 ? row[metadataIdx] : undefined;
    if (rawMetadata != null && rawMetadata.trim() !== "") {
      try {
        pair.metadata = JSON.parse(rawMetadata);
      } catch {
        // metadata 不是合法 JSON 时按字符串存，不整批失败
        pair.metadata = rawMetadata;
      }
    }
    pairs.push(pair);
  }
  return pairs;
}

/** 校验并规范化待写入的键值对，返回可直接转发给 CF 的数组。 */
function normalizePairs(input: unknown): BulkPair[] | { error: string } {
  const nested = (input as { pairs?: unknown } | null)?.pairs;
  const raw: unknown[] | null = Array.isArray(input)
    ? input
    : Array.isArray(nested)
      ? nested
      : null;

  if (raw === null) {
    return { error: "Request body must be an array of key-value pairs" };
  }
  if (raw.length === 0) {
    return { error: "No key-value pairs provided" };
  }
  if (raw.length > MAX_PAIRS) {
    return {
      error: `Too many key-value pairs: ${raw.length} (limit ${MAX_PAIRS})`,
    };
  }

  const pairs: BulkPair[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i] as Partial<BulkPair>;
    if (item == null || typeof item !== "object") {
      return { error: `Item ${i} is not an object` };
    }
    if (typeof item.key !== "string" || item.key === "") {
      return { error: `Item ${i} is missing a non-empty "key"` };
    }
    if (byteLength(item.key) > MAX_KEY_BYTES) {
      return { error: `Item ${i} key exceeds ${MAX_KEY_BYTES} bytes` };
    }
    if (typeof item.value !== "string") {
      return { error: `Item ${i} is missing a string "value"` };
    }
    if (
      item.expiration_ttl !== undefined &&
      (!Number.isFinite(item.expiration_ttl) ||
        item.expiration_ttl < MIN_TTL_SECONDS)
    ) {
      return {
        error: `Item ${i} expiration_ttl must be at least ${MIN_TTL_SECONDS} seconds`,
      };
    }
    if (item.expiration !== undefined && !Number.isFinite(item.expiration)) {
      return { error: `Item ${i} has an invalid "expiration"` };
    }

    const pair: BulkPair = { key: item.key, value: item.value };
    if (item.base64 !== undefined) pair.base64 = Boolean(item.base64);
    if (item.expiration !== undefined) pair.expiration = Number(item.expiration);
    if (item.expiration_ttl !== undefined) {
      pair.expiration_ttl = Number(item.expiration_ttl);
    }
    if (item.metadata !== undefined) pair.metadata = item.metadata;
    pairs.push(pair);
  }
  return pairs;
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { env, params } = context;
  const accountId = params.id as string;
  const namespaceId = params.namespace_id as string;

  const token = await getCloudflareToken(env, accountId);
  if (!token) {
    return jsonError("Account not found or token invalid", 404);
  }

  let parsed: unknown;
  try {
    parsed = await context.request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  let candidate: unknown;
  if (
    parsed &&
    typeof parsed === "object" &&
    !Array.isArray(parsed) &&
    typeof (parsed as { csv?: unknown }).csv === "string"
  ) {
    // CSV 导入：在服务端转成 CF bulk 需要的 JSON 数组
    const csvPairs = pairsFromCsv((parsed as { csv: string }).csv);
    if (csvPairs.length === 0) {
      return jsonError("CSV contains no usable rows", 400);
    }
    candidate = csvPairs;
  } else {
    candidate = parsed;
  }

  const normalized = normalizePairs(candidate);
  if (!Array.isArray(normalized)) {
    return jsonError(normalized.error, 400);
  }

  const payload = JSON.stringify(normalized);
  if (byteLength(payload) > MAX_BODY_BYTES) {
    return jsonError(
      `Bulk payload too large: ${byteLength(payload)} bytes (limit ${MAX_BODY_BYTES} bytes)`,
      413
    );
  }

  const response = await cloudflareFetch(
    token,
    `/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/bulk`,
    {
      method: "PUT",
      body: payload,
    }
  );

  const data = await parseCfResponse<{
    successful_key_count?: number;
    unsuccessful_keys?: string[];
  }>(response);

  if (!data.success) {
    const errorMessage =
      data.errors?.[0]?.message || "Failed to bulk write KV pairs";
    return jsonError(errorMessage, 502);
  }

  return new Response(
    JSON.stringify({
      success: true,
      successful_key_count: data.result?.successful_key_count ?? normalized.length,
      unsuccessful_keys: data.result?.unsuccessful_keys ?? [],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
