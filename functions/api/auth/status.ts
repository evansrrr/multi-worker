/**
 * GET /api/auth/status - Check if setup needed or session valid.
 * 
 * If ADMIN_PASSWORD environment variable is set and no password exists in KV,
 * it will be automatically configured.
 */

import { getConfig, getSession, setConfig } from "../../lib/kv";
import { hashPassword, ensureEncryptionKey } from "../../lib/crypto";
import { getSessionIdFromCookie } from "../../lib/cookie";

interface Env {
  TOOL_DATA: KVNamespace;
  ADMIN_PASSWORD?: string;
  TOKEN_ENC_KEY?: string;
  ENCRYPTION_KEY_SOURCE?: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  // Only allow GET method
  if (request.method !== "GET") {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed" } 
      }),
      { status: 405, headers: { "Content-Type": "application/json" } }
    );
  }

  let passwordHash = await getConfig(env, "password_hash");
  
  // Auto-setup with ADMIN_PASSWORD if environment variable is set
  if (!passwordHash) {
    const adminPassword = env.ADMIN_PASSWORD;

    if (adminPassword) {
      passwordHash = await hashPassword(adminPassword);

      await setConfig(env, "password_hash", passwordHash);
      await ensureEncryptionKey(env);
    }
  }
  
  if (!passwordHash) {
    return new Response(
      JSON.stringify({ 
        success: true, 
        data: { isAuthenticated: false, needsSetup: true } 
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  const sessionId = getSessionIdFromCookie(request);

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
