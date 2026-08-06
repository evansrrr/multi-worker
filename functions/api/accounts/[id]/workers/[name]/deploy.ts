import { getCloudflareToken } from "../../../../../lib/cloudflare";

interface Env {
  TOOL_DATA: KVNamespace;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context;
  const accountId = params.id as string;
  const workerName = params.name as string;

  const token = await getCloudflareToken(env, accountId);
  if (!token) {
    return new Response(
      JSON.stringify({ error: "Account not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const formData = await request.formData();
  const file = formData.get("files") as File | null;

  if (!file) {
    return new Response(
      JSON.stringify({ error: "No file provided" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const metadata = {
    main_module: "worker.js",
    bindings: [],
    compatibility_date: new Date().toISOString().split("T")[0],
  };

  const uploadFormData = new FormData();
  uploadFormData.append("metadata", JSON.stringify(metadata));
  uploadFormData.append("worker.js", file);

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/workers/${workerName}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: uploadFormData,
    }
  );

  const data = await response.json<{ success: boolean; errors: Array<{ message: string }> }>();

  if (!data.success) {
    return new Response(
      JSON.stringify({
        error: data.errors[0]?.message || "Failed to deploy worker",
      }),
      { status: response.status, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
