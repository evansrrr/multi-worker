import {
  getCloudflareToken,
  cloudflareFetch,
  parseCfResponse,
} from "../../../../../lib/cloudflare";

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
      JSON.stringify({ error: "Account not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const response = await cloudflareFetch(
    token,
    `/accounts/${accountId}/workers/workers/${workerName}`
  );

  const data = await parseCfResponse(response);

  if (!data.success) {
    return new Response(
      JSON.stringify({
        error: data.errors[0]?.message || "Failed to get worker details",
      }),
      { status: response.status, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ worker: data.result }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
