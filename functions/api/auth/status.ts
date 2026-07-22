/**
 * GET /api/auth/status - Check if setup needed or session valid.
 */

import { getConfig, getSession } from "../../lib/kv";

interface Env {
  TOOL_DATA: KVNamespace;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;

  const passwordHash = await getConfig(env, "password_hash");
  if (!passwordHash) {
    return new Response(
      JSON.stringify({ 
        success: true, 
        data: { isAuthenticated: false, needsSetup: true } 
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  const cookieHeader = context.request.headers.get("Cookie") || "";
  const sessionId = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("session="))
    ?.split("=")[1];

  if (!sessionId) {
    return new Response(
      JSON.stringify({ 
        success: true, 
        data: { isAuthenticated: false, needsSetup: false } 
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  const accountId = await getSession(env, sessionId);
  if (!accountId) {
    return new Response(
      JSON.stringify({ 
        success: true, 
        data: { isAuthenticated: false, needsSetup: false } 
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ 
      success: true, 
      data: { isAuthenticated: true, needsSetup: false } 
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
