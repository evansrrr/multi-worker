import {
  getCloudflareToken,
  cloudflareFetch,
  parseCfResponse,
} from "../../../../../lib/cloudflare";

interface Env {
  TOOL_DATA: KVNamespace;
}

/**
 * Deploy (upload) a Worker script via the classic scripts API:
 *   PUT /accounts/{account_id}/workers/scripts/{script_name}
 *
 * The upload must be multipart (metadata JSON part + module part). We read
 * the Worker's existing settings first so that bindings, compatibility
 * settings, and usage model survive the upload instead of being wiped.
 */
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

  // Read existing settings so the upload doesn't wipe bindings / config.
  let existingBindings: unknown[] = [];
  let compatibilityDate: string | undefined;
  let compatibilityFlags: string[] | undefined;
  try {
    const settingsRes = await cloudflareFetch(
      token,
      `/accounts/${accountId}/workers/scripts/${workerName}/settings`
    );
    const settingsData = await parseCfResponse<{
      bindings?: unknown[];
      compatibility_date?: string;
      compatibility_flags?: string[];
    }>(settingsRes);
    if (settingsData.success && settingsData.result) {
      existingBindings = settingsData.result.bindings ?? [];
      compatibilityDate = settingsData.result.compatibility_date;
      compatibilityFlags = settingsData.result.compatibility_flags;
    }
  } catch {
    // If settings can't be read (e.g. brand-new script), fall through with
    // empty bindings and default compatibility date.
  }

  const metadata: Record<string, unknown> = {
    main_module: "worker.js",
    bindings: existingBindings,
    compatibility_date:
      compatibilityDate ?? new Date().toISOString().split("T")[0],
  };
  if (compatibilityFlags && compatibilityFlags.length > 0) {
    metadata.compatibility_flags = compatibilityFlags;
  }

  const uploadFormData = new FormData();
  uploadFormData.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" })
  );
  uploadFormData.append("worker.js", file);

  // NOTE: do not set Content-Type manually — fetch must generate the
  // multipart boundary. cloudflareFetch only injects Content-Type for JSON
  // bodies, so it is safe to use here.
  const response = await cloudflareFetch(
    token,
    `/accounts/${accountId}/workers/scripts/${encodeURIComponent(workerName)}`,
    {
      method: "PUT",
      body: uploadFormData,
    }
  );

  const data = await parseCfResponse(response);

  if (!data.success) {
    return new Response(
      JSON.stringify({
        error: data.errors[0]?.message || "Failed to deploy worker",
      }),
      { status: response.status, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, bindings: existingBindings }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
