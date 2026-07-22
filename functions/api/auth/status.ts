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
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;

  let passwordHash = await getConfig(env, "password_hash");
  
  // Auto-setup with ADMIN_PASSWORD if environment variable is set
  // In Cloudflare Pages, env vars are accessed via context.env
  if (!passwordHash) {
    // Try to get ADMIN_PASSWORD from various sources
    const adminPassword = (env as any).ADMIN_PASSWORD || 
                         (env as any).admin_password ||
                         (context as any).function?.env?.ADMIN_PASSWORD;
    
    if (adminPassword) {
      passwordHash = await hashPassword(adminPassword);
      const encryptionKey = await generateEncryptionKey();
      
      await setConfig(env, "password_hash", passwordHash);
      await setConfig(env, "encryption_key", encryptionKey);
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
