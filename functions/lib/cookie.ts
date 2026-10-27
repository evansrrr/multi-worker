/**
 * Session cookie helpers shared by auth handlers and middleware.
 * Keeping the attributes in one place guarantees the cookie cleared on
 * logout matches the one set on login.
 */

const SESSION_COOKIE_NAME = "session";
const SESSION_MAX_AGE_SECONDS = 24 * 60 * 60;

export function getSessionIdFromCookie(request: Request): string | undefined {
  const cookieHeader = request.headers.get("Cookie") || "";
  const entry = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
  return entry?.split("=")[1] || undefined;
}

function secureFlag(request: Request): string {
  // Secure is required over https but must be omitted on plain
  // http://localhost dev, otherwise the browser drops the cookie.
  return new URL(request.url).protocol === "https:" ? "; Secure" : "";
}

export function buildSessionCookie(
  sessionId: string,
  request: Request
): string {
  return `${SESSION_COOKIE_NAME}=${sessionId}; HttpOnly; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}; SameSite=Lax${secureFlag(request)}`;
}

export function buildClearSessionCookie(request: Request): string {
  return `${SESSION_COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${secureFlag(request)}`;
}
