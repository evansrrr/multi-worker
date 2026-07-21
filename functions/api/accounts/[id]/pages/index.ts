/**
 * GET /api/accounts/:id/pages - List Pages projects
 * POST /api/accounts/:id/pages - Create Pages project
 */

import {
  getCloudflareToken,
  cloudflareFetch,
  parseCfResponse,
} from "../../../../lib/cloudflare";

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

  const token = await getCloudflareToken(env, accountId);
  if (!token) {
    return new Response(
      JSON.stringify({ error: "Account not found or token invalid" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const response = await cloudflareFetch(
    token,
    `/accounts/${accountId}/pages/projects`
  );

  const data = await parseCfResponse<PagesProject[]>(response);

  if (!data.success) {
    const errorMessage =
      data.errors?.[0]?.message || "Failed to list Pages projects";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ projects: data.result }),
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

  const body = await context.request.json<{
    name: string;
    production_branch?: string;
  }>();
  if (!body.name) {
    return new Response(
      JSON.stringify({ error: "Project name is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const projectData: Record<string, unknown> = {
    name: body.name,
  };

  if (body.production_branch) {
    projectData.production_branch = body.production_branch;
  }

  const response = await cloudflareFetch(
    token,
    `/accounts/${accountId}/pages/projects`,
    {
      method: "POST",
      body: JSON.stringify(projectData),
    }
  );

  const data = await parseCfResponse<PagesProject>(response);

  if (!data.success) {
    const errorMessage =
      data.errors?.[0]?.message || "Failed to create Pages project";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ project: data.result }),
    { status: 201, headers: { "Content-Type": "application/json" } }
  );
};
