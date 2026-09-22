/**
 * GET /api/accounts/:id/pages/:name - Get Pages project details
 */

import {
  getCloudflareToken,
  cloudflareFetch,
  parseCfResponse,
} from "../../../../../lib/cloudflare";

interface Env {
  TOOL_DATA: KVNamespace;
}

export interface PagesProject {
  id: string;
  name: string;
  created_on: string;
  production_branch: string;
  subdomain: string;
  domains: string[];
  uses_functions: boolean;
  source?: {
    type: string;
    config: {
      owner: string;
      repo_name: string;
      production_branch: string;
    };
  };
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
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
    `/accounts/${accountId}/pages/projects/${projectName}`
  );

  const data = await parseCfResponse<PagesProject>(response);

  if (!data.success) {
    const errorMessage =
      data.errors?.[0]?.message || "Failed to get Pages project details";
    const status = response.status === 404 ? 404 : 502;
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ project: data.result }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
