/**
 * GET /api/accounts/:id/kv/:namespace_id/export - 导出命名空间内的键值对为 JSON
 *
 * 流程（全部走 KV.md 中记录的官方端点）：
 *   1) GET .../keys?limit&cursor&prefix  按 cursor 分页拉键名，直到达到上限或列表结束
 *   2) POST .../bulk/get  每 100 个键一批拉取值（KV.md 限定批量读取上限 100）
 *
 * 查询参数：
 *   - prefix:          只导出该前缀下的键
 *   - limit:           最多导出的键数量，默认 1000，硬上限 10000
 *   - with_metadata:   "false" 时跳过 metadata（少一次字段，导出更快）
 *
 * 响应：{ namespace_id, prefix, count, truncated, items: [{ key, value, expiration?, metadata? }] }
 * 并以 attachment 形式给出 .json 文件名。超出 limit 时 truncated=true，
 * 前端应提示用户缩小 prefix 或分批导出——这样能保证在 Pages Functions 的
 * CPU / 子请求预算内返回，不会超时。
 */

import {
  getCloudflareToken,
  cloudflareFetch,
  parseCfResponse,
} from "../../../../../lib/cloudflare";

interface Env {
  TOOL_DATA: KVNamespace;
}

/** 单次 list 请求最多取 1000 个键（CF 的 limit 上限）。 */
const LIST_PAGE_SIZE = 1000;
/** 导出的键数量默认值与硬上限。 */
const DEFAULT_MAX_KEYS = 1000;
const HARD_MAX_KEYS = 10_000;
/** 批量读取每批最多 100 个键（KV.md 限定）。 */
const BULK_GET_CHUNK = 100;

interface KvKeyInfo {
  name: string;
  expiration?: number;
  metadata?: unknown;
}

interface KvListResultInfo {
  count?: number;
  cursor?: string;
}

interface ExportItem {
  key: string;
  value: unknown;
  expiration?: number;
  metadata?: unknown;
  error?: string;
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** 用 cursor 分页把键名拉到上限为止。 */
async function listKeys(
  token: string,
  accountId: string,
  namespaceId: string,
  prefix: string | undefined,
  maxKeys: number
): Promise<{ keys: KvKeyInfo[]; truncated: boolean }> {
  const keys: KvKeyInfo[] = [];
  let cursor: string | undefined;
  let truncated = false;
  // 上限保护：即便 CF 返回异常游标也不会死循环
  const maxPages = Math.ceil(maxKeys / LIST_PAGE_SIZE) + 2;

  for (let page = 0; page < maxPages; page++) {
    const pageLimit = Math.min(LIST_PAGE_SIZE, maxKeys - keys.length);
    if (pageLimit <= 0) break;

    const path =
      `/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/keys` +
      `?limit=${pageLimit}` +
      (prefix ? `&prefix=${encodeURIComponent(prefix)}` : "") +
      (cursor ? `&cursor=${encodeURIComponent(cursor)}` : "");

    const response = await cloudflareFetch(token, path);
    const data = await parseCfResponse<KvKeyInfo[]>(response);
    if (!data.success) {
      throw new Error(data.errors?.[0]?.message || "Failed to list KV keys");
    }

    const pageKeys = data.result ?? [];
    keys.push(...pageKeys);
    const resultInfo = (data as unknown as { result_info?: KvListResultInfo })
      .result_info;
    cursor = resultInfo?.cursor;

    if (!cursor || pageKeys.length === 0) break;
    if (keys.length >= maxKeys) {
      truncated = true;
      break;
    }
  }

  return { keys: keys.slice(0, maxKeys), truncated };
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context;
  const accountId = params.id as string;
  const namespaceId = params.namespace_id as string;

  const token = await getCloudflareToken(env, accountId);
  if (!token) {
    return jsonError("Account not found or token invalid", 404);
  }

  const url = new URL(context.request.url);
  const prefix = url.searchParams.get("prefix") || undefined;
  const requested = Number(url.searchParams.get("limit")) || DEFAULT_MAX_KEYS;
  const maxKeys = Math.min(Math.max(requested, 1), HARD_MAX_KEYS);
  const withMetadata = url.searchParams.get("with_metadata") !== "false";

  let listing: { keys: KvKeyInfo[]; truncated: boolean };
  try {
    listing = await listKeys(token, accountId, namespaceId, prefix, maxKeys);
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : "Failed to list KV keys",
      502
    );
  }

  const keys = listing.keys;
  const items: ExportItem[] = [];

  // 批量取值：每批 100 个键。单批失败时只标记该批，不整份导出失败。
  for (let i = 0; i < keys.length; i += BULK_GET_CHUNK) {
    const chunk = keys.slice(i, i + BULK_GET_CHUNK);
    const chunkKeys = chunk.map((k) => k.name);

    let response: Response;
    try {
      response = await cloudflareFetch(
        token,
        `/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/bulk/get`,
        {
          method: "POST",
          body: JSON.stringify({
            keys: chunkKeys,
            type: "text",
            withMetadata,
          }),
        }
      );
    } catch (err) {
      for (const name of chunkKeys) {
        items.push({
          key: name,
          value: null,
          error: err instanceof Error ? err.message : "Failed to read value",
        });
      }
      continue;
    }

    if (!response.ok) {
      const message = `Failed to read values (${response.status})`;
      for (const name of chunkKeys) {
        items.push({ key: name, value: null, error: message });
      }
      continue;
    }

    let values: Record<string, unknown> = {};
    try {
      const data = await parseCfResponse<{ values?: Record<string, unknown> }>(
        response
      );
      values = data.result?.values ?? {};
    } catch {
      values = {};
    }

    for (const info of chunk) {
      const raw = values[info.name];
      if (raw == null) {
        // 值不是文本（例如二进制），bulk/get 不会返回，标记为需单独读取
        items.push({
          key: info.name,
          value: null,
          expiration: info.expiration,
          metadata: info.metadata,
          error: "Value unavailable via bulk get (binary or missing)",
        });
        continue;
      }
      if (
        withMetadata &&
        typeof raw === "object" &&
        raw !== null &&
        "value" in (raw as Record<string, unknown>)
      ) {
        const wrapped = raw as {
          value?: unknown;
          metadata?: unknown;
          expiration?: number;
        };
        items.push({
          key: info.name,
          value: wrapped.value ?? null,
          expiration: wrapped.expiration ?? info.expiration,
          metadata: wrapped.metadata ?? info.metadata,
        });
      } else {
        items.push({
          key: info.name,
          value: raw,
          expiration: info.expiration,
          metadata: info.metadata,
        });
      }
    }
  }

  const body = JSON.stringify({
    namespace_id: namespaceId,
    prefix: prefix ?? null,
    count: items.length,
    truncated: listing.truncated,
    items,
  });

  const filename = `kv-export-${namespaceId}-${Date.now()}.json`;
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
};
