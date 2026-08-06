/**
 * POST /api/batch/delete - Delete multiple Workers and/or Pages in one request
 */

import {
  getCloudflareToken,
  cloudflareFetch,
  parseCfResponse,
} from "../../lib/cloudflare";

interface Env {
  TOOL_DATA: KVNamespace;
}

interface BatchTarget {
  accountId: string;
  name: string;
  type: "worker" | "pages";
}

interface BatchDeleteRequest {
  targets: BatchTarget[];
}

interface BatchResult {
  name: string;
  success: boolean;
  error?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env } = context;

  let body: BatchDeleteRequest;
  try {
    body = await context.request.json<BatchDeleteRequest>();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!body.targets || !Array.isArray(body.targets) || body.targets.length === 0) {
    return new Response(
      JSON.stringify({ error: "targets array is required and must not be empty" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const results: BatchResult[] = [];

  for (const target of body.targets) {
    const { accountId, name, type } = target;

    if (!accountId || !name || !type) {
      results.push({ name, success: false, error: "Missing required fields" });
      continue;
    }

    const token = await getCloudflareToken(env, accountId);
    if (!token) {
      results.push({ name, success: false, error: "Account not found or token invalid" });
      continue;
    }

    const apiPath =
      type === "worker"
        ? `/accounts/${accountId}/workers/workers/${name}`
        : `/accounts/${accountId}/pages/projects/${name}`;

    try {
      const response = await cloudflareFetch(token, apiPath, { method: "DELETE" });
      const data = await parseCfResponse(response);

      if (!data.success) {
        const errorMessage = data.errors?.[0]?.message || "Failed to delete";
        results.push({ name, success: false, error: errorMessage });
      } else {
        results.push({ name, success: true });
      }
    } catch (err) {
      results.push({ name, success: false, error: (err as Error).message || "Request failed" });
    }
  }

  return new Response(
    JSON.stringify({ results }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
