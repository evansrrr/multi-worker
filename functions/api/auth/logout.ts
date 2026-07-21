/**
 * POST /api/auth/logout - Clear session.
 */

import { deleteSession } from "../../lib/kv";

interface Env {
  TOOL_DATA: KVNamespace;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env } = context;

  const cookieHeader = context.request.headers.get("Cookie") || "";
  const sessionId = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("session="))
    ?.split("=")[1];

  if (sessionId) {
    await deleteSession(env, sessionId);
  }

  const response = new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );

  response.headers.set(
    "Set-Cookie",
    "session=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict"
  );

  return response;
};
