/**
 * PUT /api/settings/password - Change admin password.
 */

import { verifyPassword, hashPassword } from "../../lib/crypto";
import { getConfig, setConfig } from "../../lib/kv";

interface Env {
  TOOL_DATA: KVNamespace;
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { env } = context;

  const body = await context.request.json<{
    currentPassword: string;
    newPassword: string;
  }>();

  if (!body.currentPassword || !body.newPassword) {
    return new Response(
      JSON.stringify({ error: "Current password and new password are required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (body.newPassword.length < 8) {
    return new Response(
      JSON.stringify({ error: "New password must be at least 8 characters" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const passwordHash = await getConfig(env, "password_hash");
  if (!passwordHash) {
    return new Response(
      JSON.stringify({ error: "No password set" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const valid = await verifyPassword(body.currentPassword, passwordHash);
  if (!valid) {
    return new Response(
      JSON.stringify({ error: "Current password is incorrect" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const newHash = await hashPassword(body.newPassword);
  await setConfig(env, "password_hash", newHash);

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
