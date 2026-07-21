/**
 * GET /api/settings/appearance - Get appearance setting
 * PUT /api/settings/appearance - Update appearance setting
 */

import { getConfig, setConfig } from "../../lib/kv";

interface Env {
  TOOL_DATA: KVNamespace;
}

const VALID_MODES = ["light", "dark", "system"];

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;
  const mode = await getConfig(env, "appearance");
  return new Response(
    JSON.stringify({ mode: mode || "system" }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { env } = context;

  const body = await context.request.json<{ mode: string }>();
  if (!body.mode || !VALID_MODES.includes(body.mode)) {
    return new Response(
      JSON.stringify({ error: `Invalid mode. Must be one of: ${VALID_MODES.join(", ")}` }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  await setConfig(env, "appearance", body.mode);
  return new Response(
    JSON.stringify({ success: true, mode: body.mode }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
