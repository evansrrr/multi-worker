/**
 * POST /api/auth/login - Authenticate with password and create session.
 */

import {
  hashPassword,
  passwordNeedsUpgrade,
  verifyPassword,
} from "../../lib/crypto";
import {
  clearLoginFailures,
  getConfig,
  getLoginFailures,
  getSessionEpoch,
  isLoginLocked,
  recordLoginFailure,
  setConfig,
  setSession,
} from "../../lib/kv";
import { buildSessionCookie } from "../../lib/cookie";

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

  // Parse the body before touching KV: a malformed body must not cost a
  // round trip on a slow link.
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

  // Rate limiting: 5 failed attempts per 15 minutes per client IP.
  const clientIp = request.headers.get("CF-Connecting-IP") || "unknown";

  // The stored hash and the failure counter are independent keys, so they are
  // read concurrently. On a slow link a single KV read can take seconds;
  // serializing the two would double the login latency for no reason.
  const [passwordHash, failState] = await Promise.all([
    getConfig(env, "password_hash"),
    getLoginFailures(env, clientIp),
  ]);

  if (!passwordHash) {
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: "NO_PASSWORD", message: "No password set. Please complete setup first." }
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Unified failure response. A wrong password and a locked-out IP return the
  // exact same body so the two cases cannot be told apart.
  const unifiedFailure = () =>
    new Response(
      JSON.stringify({
        success: false,
        error: { code: "INVALID_PASSWORD", message: "Invalid password" }
      }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );

  if (isLoginLocked(failState)) {
    return unifiedFailure();
  }

  const valid = await verifyPassword(body.password, passwordHash);
  if (!valid) {
    await recordLoginFailure(env, clientIp);
    return unifiedFailure();
  }

  // Legacy (unsalted SHA-256) hashes are silently upgraded to PBKDF2.
  if (passwordNeedsUpgrade(passwordHash)) {
    await setConfig(env, "password_hash", await hashPassword(body.password));
  }

  // The epoch read and the failure-counter cleanup are independent. The
  // delete is skipped when there were no failures at all, so the common
  // "correct password on first try" path does not pay for a KV write.
  const [epoch] = await Promise.all([
    getSessionEpoch(env),
    failState.count > 0 ? clearLoginFailures(env, clientIp) : Promise.resolve(),
  ]);

  const sessionId = crypto.randomUUID();
  await setSession(env, sessionId, "admin", epoch);

  // The session id is only delivered through the HttpOnly cookie and is
  // never exposed in the response body.
  const response = new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );

  response.headers.set("Set-Cookie", buildSessionCookie(sessionId, request));

  return response;
};
