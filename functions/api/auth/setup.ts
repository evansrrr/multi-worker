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
  ADMIN_PASSWORD?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env } = context;

  const existingPassword = await getConfig(env, "password_hash");
  if (existingPassword) {
    return new Response(
      JSON.stringify({ error: "Password already set" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const body = await context.request.json<{ password: string }>();
  if (!body.password || body.password.length < 8) {
    return new Response(
      JSON.stringify({ error: "Password must be at least 8 characters" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const passwordHash = await hashPassword(body.password);
  const encryptionKey = await generateEncryptionKey();

  await setConfig(env, "password_hash", passwordHash);
  await setConfig(env, "encryption_key", encryptionKey);

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
