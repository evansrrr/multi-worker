/**
 * POST /api/accounts/:id/pages/:name/deploy - Deploy new version
 */

import {
  getCloudflareToken,
  cloudflareFetch,
  parseCfResponse,
} from "../../../../../lib/cloudflare";

interface Env {
  TOOL_DATA: KVNamespace;
}

export interface Deployment {
  id: string;
  project_id: string;
  project_name: string;
  short_id: string;
  created_on: string;
  modified_on: string;
  environment: "preview" | "production";
  url: string;
  is_skipped: boolean;
  latest_stage: {
    name: string;
    started_on: string | null;
    ended_on: string | null;
    status: string;
  };
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, params } = context;
  const accountId = params.id as string;
  const projectName = params.name as string;

  const token = await getCloudflareToken(env, accountId);
  if (!token) {
    return new Response(
      JSON.stringify({ error: "Account not found or token invalid" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const response = await cloudflareFetch(
    token,
    `/accounts/${accountId}/pages/projects/${projectName}/deployments`,
    {
      method: "POST",
    }
  );

  const data = await parseCfResponse<Deployment>(response);

  if (!data.success) {
    const errorMessage =
      data.errors?.[0]?.message || "Failed to deploy Pages project";
    const status = response.status === 404 ? 404 : 502;
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ deployment: data.result }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
