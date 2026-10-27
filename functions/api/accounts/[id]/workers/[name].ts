/**
 * GET /api/accounts/:id/workers/:name - Get worker details
 * DELETE /api/accounts/:id/workers/:name - Delete worker
 *
 * GET 与 DELETE 统一放在本文件：Pages Functions 里同 routePath 的同名 method
 * 导出会被静默覆盖（wrangler 对同路由条目做 Object.assign），拆成两个文件
 * （如 [name]/index.ts）会导致其中一个 method 随机失效，因此这里只保留一份。
 */

import {
  getCloudflareToken,
  cloudflareFetch,
  parseCfResponse,
} from "../../../../lib/cloudflare";
import { normalizeScript, WorkerScript } from "./index";

interface Env {
  TOOL_DATA: KVNamespace;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context;
  const accountId = params.id as string;
  const workerName = params.name as string;

  const token = await getCloudflareToken(env, accountId);
  if (!token) {
    return new Response(
      JSON.stringify({ error: "Account not found or token invalid" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const response = await cloudflareFetch(
    token,
    `/accounts/${accountId}/workers/scripts`
  );

  const data = await parseCfResponse<WorkerScript[]>(response);

  if (!data.success) {
    const errorMessage =
      data.errors?.[0]?.message || "Failed to get worker details";
    const status = response.status === 404 ? 404 : 502;
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status, headers: { "Content-Type": "application/json" } }
    );
  }

  const script = (Array.isArray(data.result) ? data.result : []).find(
    (item) => item.id === workerName
  );

  if (!script) {
    return new Response(
      JSON.stringify({ error: "Worker not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ worker: normalizeScript(script) }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { env, params } = context;
  const accountId = params.id as string;
  const workerName = params.name as string;

  const token = await getCloudflareToken(env, accountId);
  if (!token) {
    return new Response(
      JSON.stringify({ error: "Account not found or token invalid" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const response = await cloudflareFetch(
    token,
    `/accounts/${accountId}/workers/scripts/${encodeURIComponent(workerName)}`,
    {
      method: "DELETE",
    }
  );

  // 经典删除"成功时没有响应体"（Workers.md 11462-11466），此时不能走
  // parseCfResponse，否则会因为拿不到 JSON 而抛错；直接按状态码判定。
  const contentType = response.headers.get("Content-Type") ?? "";
  if (!contentType.includes("json")) {
    if (response.ok) {
      return new Response(
        JSON.stringify({ success: true, name: workerName }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response(
      JSON.stringify({
        error: `Failed to delete worker (status ${response.status})`,
      }),
      { status: response.status === 404 ? 404 : 502, headers: { "Content-Type": "application/json" } }
    );
  }

  const data = await parseCfResponse<{ id?: string }>(response);

  if (!data.success) {
    const errorMessage = data.errors?.[0]?.message || "Failed to delete worker";
    const status = response.status === 404 ? 404 : 502;
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, name: workerName }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
