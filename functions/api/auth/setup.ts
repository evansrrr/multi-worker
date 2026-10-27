/**
 * POST /api/auth/setup - First-time password and encryption key setup.
 * 
 * Supports ADMIN_PASSWORD environment variable for initial setup.
 * If ADMIN_PASSWORD is set and no password exists in KV, it will be used automatically.
 */

import { hashPassword, ensureEncryptionKey } from "../../lib/crypto";
import { getConfig, setConfig } from "../../lib/kv";

interface Env {
  TOOL_DATA: KVNamespace;
  TOKEN_ENC_KEY?: string;
  ENCRYPTION_KEY_SOURCE?: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  // Only allow POST method
  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed" } 
      }),
      { status: 405, headers: { "Content-Type": "application/json" } }
    );
  }

  const existingPassword = await getConfig(env, "password_hash");
  if (existingPassword) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: { code: "ALREADY_SET", message: "Password already set" } 
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: { password?: string };
  try {
    body = await request.json<{ password?: string }>();
  } catch {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: { code: "INVALID_BODY", message: "Invalid request body" } 
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!body.password || body.password.length < 8) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: { code: "WEAK_PASSWORD", message: "Password must be at least 8 characters" } 
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const passwordHash = await hashPassword(body.password);

  await setConfig(env, "password_hash", passwordHash);
  // Uses the Worker Secret TOKEN_ENC_KEY when configured, otherwise
  // generates and stores a KV key (legacy behaviour).
  await ensureEncryptionKey(env);

  return new Response(
    JSON.stringify({ success: true, data: { message: "Setup complete" } }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
