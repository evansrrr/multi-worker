/**
 * GET  /api/accounts/:id/workers - List workers
 * POST /api/accounts/:id/workers - Create worker
 *
 * 统一走经典脚本端点 `/accounts/{id}/workers/scripts`：
 * - Beta 的 `/workers/workers` 在官方文档里标注 `# Beta`，字段语义随时可能变；
 * - settings / bindings / secrets / schedules / subdomain / content 本来就只有经典端点，
 *   混用两套会导致 id（脚本名）与时间字段对不上。
 */

import {
  getCloudflareToken,
  cloudflareFetch,
  parseCfResponse,
} from "../../../../lib/cloudflare";

interface Env {
  TOOL_DATA: KVNamespace;
}

/**
 * 经典 `/workers/scripts` 返回的 Script 对象（Workers.md 9899 起
 * "Scripts > List Workers" 与 11555 起 "Domain Types > Script"）。
 * 实际有 20+ 个字段且随平台演进，这里只声明本项目真正用到的部分。
 */
export interface WorkerScript {
  /** 经典 API 用 id 承载脚本名，没有独立的 name 字段。 */
  id?: string;
  created_on?: string;
  modified_on?: string;
  logpush?: boolean;
  tags?: string[];
  usage_model?: string;
  handlers?: string[];
  etag?: string;
  /** 经典端点确实返回 routes（官方文档确认），用于展示已绑定的路由。 */
  routes?: Array<{ id?: string; pattern?: string; script?: string }>;
  [key: string]: unknown;
}

/**
 * 把经典 Script 对齐到前端使用的口径：经典只有 id / created_on / modified_on，
 * 而前端按 name / updated_on 取用（列表、删除、部署都以 name 为键）。
 */
export function normalizeScript(script: WorkerScript) {
  return {
    ...script,
    name: script.id ?? "",
    updated_on: script.modified_on ?? script.created_on ?? "",
  };
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context;
  const accountId = params.id as string;

  const token = await getCloudflareToken(env, accountId);
  if (!token) {
    return new Response(
      JSON.stringify({ error: "Account not found or token invalid" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  // 经典端点只支持 tags 过滤，不支持 page/per_page（Workers.md 9913
  // "Scripts > List Workers > Query Parameters" 仅列出 tags），一次返回全部脚本。
  // 所以这里不再透传分页参数，并在响应里显式说明，避免前端误以为还能翻页。
  const response = await cloudflareFetch(
    token,
    `/accounts/${accountId}/workers/scripts`
  );

  const data = await parseCfResponse<WorkerScript[]>(response);

  if (!data.success) {
    const errorMessage = data.errors?.[0]?.message || "Failed to list workers";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  const workers = (Array.isArray(data.result) ? data.result : []).map(
    normalizeScript
  );

  return new Response(
    JSON.stringify({
      workers,
      pagination: {
        supported: false,
        reason: "经典 /workers/scripts 端点不支持分页，已一次返回全部脚本",
      },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, params } = context;
  const accountId = params.id as string;

  const token = await getCloudflareToken(env, accountId);
  if (!token) {
    return new Response(
      JSON.stringify({ error: "Account not found or token invalid" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const body = await context.request.json<{ name: string; script?: string }>();
  if (!body.name) {
    return new Response(
      JSON.stringify({ error: "Worker name is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // 经典端点上传即创建：PUT /workers/scripts/{name} 会直接建出脚本，
  // 不需要先在 Beta /workers/workers 上注册实体（那套两步走会留下半创建状态）。
  const metadata = {
    main_module: "worker.js",
    compatibility_date: new Date().toISOString().split("T")[0],
  };

  const formData = new FormData();
  formData.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" })
  );

  const script =
    body.script ||
    `export default {
  async fetch(request) {
    return new Response("Hello from ${body.name}!");
  },
};`;
  formData.append(
    "worker.js",
    new Blob([script], { type: "application/javascript+module" }),
    "worker.js"
  );

  // 不要手动设置 Content-Type，fetch 需要自己生成 multipart boundary。
  const uploadRes = await cloudflareFetch(
    token,
    `/accounts/${accountId}/workers/scripts/${encodeURIComponent(body.name)}`,
    {
      method: "PUT",
      body: formData,
    }
  );
  const uploadData = await parseCfResponse<WorkerScript>(uploadRes);
  if (!uploadData.success) {
    const errorMessage =
      uploadData.errors?.[0]?.message || "Failed to upload worker script";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({
      worker: normalizeScript(uploadData.result ?? { id: body.name }),
    }),
    { status: 201, headers: { "Content-Type": "application/json" } }
  );
};
