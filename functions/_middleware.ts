/**
 * Auth middleware for API routes.
 * Validates session cookie for all /api/* routes except auth endpoints.
 */

import { getSession } from "./lib/kv";

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

  // Skip auth for non-API routes (static files)
  if (!pathname.startsWith("/api/")) {
    return context.next();
  }

  // Skip auth for public auth routes
  if (PUBLIC_AUTH_ROUTES.includes(pathname)) {
    return context.next();
  }

  // Extract session cookie
  const cookieHeader = request.headers.get("Cookie") || "";
  const sessionId = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("session="))
    ?.split("=")[1];

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

  // Session valid - continue to handler
  return context.next();
};
