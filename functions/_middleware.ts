/**
 * Auth middleware for API routes.
 * Validates session cookie for all /api/* routes except auth endpoints.
 *
 * Session validation (including the session_epoch comparison that
 * invalidates sessions issued before a password change) happens inside
 * getSession() in lib/kv.ts.
 */

import { getSession } from "./lib/kv";
import { getSessionIdFromCookie } from "./lib/cookie";

interface Env {
  TOOL_DATA: KVNamespace;
}

const PUBLIC_AUTH_ROUTES = [
  "/api/auth/setup",
  "/api/auth/login",
  "/api/auth/status",
];

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  try {
    // Skip auth for non-API routes (static files)
    if (!pathname.startsWith("/api/")) {
      return context.next();
    }

    // Skip auth for public auth routes
    if (PUBLIC_AUTH_ROUTES.includes(pathname)) {
      return context.next();
    }

    // Extract session cookie
    const sessionId = getSessionIdFromCookie(request);

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Validate session
    const accountId = await getSession(env, sessionId);
    if (!accountId) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired session" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Session valid - continue to handler. Wrapping next() in the same
    // try/catch means an exception thrown by any downstream handler is
    // converted to JSON here, instead of Cloudflare's default HTML error
    // page — which would surface in the browser as an opaque
    // `Unexpected token '<'` JSON parse failure.
    return await context.next();
  } catch (error) {
    console.error("API request failed:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "服务暂时不可用，请稍后重试",
        },
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
