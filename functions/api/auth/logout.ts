/**
 * POST /api/auth/logout - Clear session.
 */

import { deleteSession } from "../../lib/kv";
import {
  buildClearSessionCookie,
  getSessionIdFromCookie,
} from "../../lib/cookie";

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

  const sessionId = getSessionIdFromCookie(request);
  if (sessionId) {
    await deleteSession(env, sessionId);
  }

  const response = new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );

  response.headers.set("Set-Cookie", buildClearSessionCookie(request));

  return response;
};
