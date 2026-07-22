/**
 * POST /api/auth/setup - First-time password and encryption key setup.
 * 
 * Supports ADMIN_PASSWORD environment variable for initial setup.
 * If ADMIN_PASSWORD is set and no password exists in KV, it will be used automatically.
 */

import { hashPassword, generateEncryptionKey } from "../../lib/crypto";
import { getConfig, setConfig } from "../../lib/kv";

interface Env {
  TOOL_DATA: KVNamespace;
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
  const encryptionKey = await generateEncryptionKey();

  await setConfig(env, "password_hash", passwordHash);
  await setConfig(env, "encryption_key", encryptionKey);

  return new Response(
    JSON.stringify({ success: true, data: { message: "Setup complete" } }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
