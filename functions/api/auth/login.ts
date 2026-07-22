/**
 * POST /api/auth/login - Authenticate with password and create session.
 */

import { verifyPassword } from "../../lib/crypto";
import { getConfig, setSession } from "../../lib/kv";

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

  const passwordHash = await getConfig(env, "password_hash");
  if (!passwordHash) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: { code: "NO_PASSWORD", message: "No password set. Please complete setup first." } 
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

  if (!body.password) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: { code: "MISSING_PASSWORD", message: "Password is required" } 
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const valid = await verifyPassword(body.password, passwordHash);
  if (!valid) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: { code: "INVALID_PASSWORD", message: "Invalid password" } 
      }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const sessionId = crypto.randomUUID();
  await setSession(env, sessionId, "admin");

  const response = new Response(
    JSON.stringify({ success: true, data: { sessionId } }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );

  response.headers.set(
    "Set-Cookie",
    `session=${sessionId}; HttpOnly; Path=/; Max-Age=86400; SameSite=Strict`
  );

  return response;
};
