/**
 * POST /api/auth/login - Authenticate with password and create session.
 */

import { verifyPassword } from "../../lib/crypto";
import { getConfig, setSession } from "../../lib/kv";

interface Env {
  TOOL_DATA: KVNamespace;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env } = context;

  const passwordHash = await getConfig(env, "password_hash");
  if (!passwordHash) {
    return new Response(
      JSON.stringify({ error: "No password set. Please complete setup first." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const body = await context.request.json<{ password: string }>();
  if (!body.password) {
    return new Response(
      JSON.stringify({ error: "Password is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const valid = await verifyPassword(body.password, passwordHash);
  if (!valid) {
    return new Response(
      JSON.stringify({ error: "Invalid password" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const sessionId = crypto.randomUUID();
  await setSession(env, sessionId, "admin");

  const response = new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );

  response.headers.set(
    "Set-Cookie",
    `session=${sessionId}; HttpOnly; Path=/; Max-Age=86400; SameSite=Strict`
  );

  return response;
};
