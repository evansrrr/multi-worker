/**
 * GET /api/auth/status - Check if setup needed or session valid.
 * 
 * If ADMIN_PASSWORD environment variable is set and no password exists in KV,
 * it will be automatically configured.
 */

import { getConfig, getSession, setConfig } from "../../lib/kv";
import { hashPassword, generateEncryptionKey } from "../../lib/crypto";

interface Env {
  TOOL_DATA: KVNamespace;
  ADMIN_PASSWORD?: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;

  let passwordHash = await getConfig(env, "password_hash");
  
  // Auto-setup with ADMIN_PASSWORD if environment variable is set
  if (!passwordHash && env.ADMIN_PASSWORD) {
    passwordHash = await hashPassword(env.ADMIN_PASSWORD);
    const encryptionKey = await generateEncryptionKey();
    
    await setConfig(env, "password_hash", passwordHash);
    await setConfig(env, "encryption_key", encryptionKey);
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
