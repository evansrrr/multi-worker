/**
 * KV storage utilities for configuration and sessions.
 */

import { resolveEncryptionKey } from "./crypto";

const SESSION_EXPIRY_SECONDS = 24 * 60 * 60; // 24 hours

// Login failure rate limiting: 5 failures per 15 minutes per IP.
const LOGIN_FAIL_WINDOW_SECONDS = 15 * 60;
const LOGIN_FAIL_MAX_ATTEMPTS = 5;

interface Env {
  TOOL_DATA: KVNamespace;
  TOKEN_ENC_KEY?: string;
  ENCRYPTION_KEY_SOURCE?: string;
}

export async function getConfig(env: Env, key: string): Promise<string | null> {
  // The encryption key is resolved through the active key source (Worker
  // Secret TOKEN_ENC_KEY or the legacy KV entry) instead of a blind KV read,
  // so every consumer keeps using one consistent key.
  if (key === "encryption_key") {
    return resolveEncryptionKey(env);
  }
  return env.TOOL_DATA.get(`config:${key}`);
}

export async function setConfig(
  env: Env,
  key: string,
  value: string
): Promise<void> {
  await env.TOOL_DATA.put(`config:${key}`, value);
}

// Session utilities
//
// Session values are JSON records `{"u":"user","e":<epoch>}`. The epoch is
// compared against config:session_epoch so that a password change can
// invalidate every previously issued session at once.

export interface SessionRecord {
  u: string; // user name
  e: number; // session epoch at creation time
}

export async function getSessionEpoch(env: Env): Promise<number> {
  const raw = await env.TOOL_DATA.get("config:session_epoch");
  const value = raw === null ? 0 : Number(raw);
  return Number.isFinite(value) ? value : 0;
}

export async function incrementSessionEpoch(env: Env): Promise<number> {
  const next = (await getSessionEpoch(env)) + 1;
  await env.TOOL_DATA.put("config:session_epoch", String(next));
  return next;
}

export async function setSession(
  env: Env,
  sessionId: string,
  user: string,
  epoch: number
): Promise<void> {
  const record: SessionRecord = { u: user, e: epoch };
  await env.TOOL_DATA.put(`session:${sessionId}`, JSON.stringify(record), {
    expirationTtl: SESSION_EXPIRY_SECONDS,
  });
}

/**
 * Return the session's user when the session exists and is still valid.
 * A session is invalid when its epoch no longer matches config:session_epoch
 * (i.e. it was issued before a password change). Legacy sessions stored as a
 * plain user string carry no epoch and stay valid until they expire.
 */
export async function getSession(
  env: Env,
  sessionId: string
): Promise<string | null> {
  const raw = await env.TOOL_DATA.get(`session:${sessionId}`);
  if (!raw) return null;

  if (!raw.startsWith("{")) {
    // Legacy format: plain user string without an epoch.
    return raw;
  }

  let record: SessionRecord;
  try {
    record = JSON.parse(raw) as SessionRecord;
  } catch {
    return null;
  }
  if (!record || typeof record.u !== "string") return null;

  const currentEpoch = await getSessionEpoch(env);
  if (record.e !== currentEpoch) return null;
  return record.u;
}

export async function deleteSession(
  env: Env,
  sessionId: string
): Promise<void> {
  await env.TOOL_DATA.delete(`session:${sessionId}`);
}

// Login failure rate limiting
//
// Values are JSON `{count, since}` under `login_fail:{ip}`, where `since` is
// the epoch ms of the first failure in the current window. The KV TTL acts as
// garbage collection; the window itself is enforced lazily on read.

export interface LoginFailState {
  count: number;
  since: number;
}

export async function getLoginFailures(
  env: Env,
  ip: string
): Promise<LoginFailState> {
  const raw = await env.TOOL_DATA.get(`login_fail:${ip}`);
  if (!raw) return { count: 0, since: 0 };
  let state: LoginFailState;
  try {
    const parsed = JSON.parse(raw) as Partial<LoginFailState>;
    if (typeof parsed.count !== "number" || typeof parsed.since !== "number") {
      return { count: 0, since: 0 };
    }
    state = { count: parsed.count, since: parsed.since };
  } catch {
    return { count: 0, since: 0 };
  }
  // Lazily expire windows that are older than the lockout window.
  if (Date.now() - state.since >= LOGIN_FAIL_WINDOW_SECONDS * 1000) {
    return { count: 0, since: 0 };
  }
  return state;
}

export async function recordLoginFailure(env: Env, ip: string): Promise<void> {
  const now = Date.now();
  const state = await getLoginFailures(env, ip);
  const next: LoginFailState =
    state.count === 0
      ? { count: 1, since: now }
      : { count: state.count + 1, since: state.since };
  await env.TOOL_DATA.put(`login_fail:${ip}`, JSON.stringify(next), {
    expirationTtl: LOGIN_FAIL_WINDOW_SECONDS,
  });
}

export async function clearLoginFailures(env: Env, ip: string): Promise<void> {
  await env.TOOL_DATA.delete(`login_fail:${ip}`);
}

export function isLoginLocked(state: LoginFailState): boolean {
  return state.count >= LOGIN_FAIL_MAX_ATTEMPTS;
}

// Account storage utilities

export interface Account {
  id: string;
  name: string;
  type: string;
  email: string;
  encryptedToken: string;
  iv: string;
}

export async function getAccounts(env: Env): Promise<Account[]> {
  const list = await env.TOOL_DATA.list({ prefix: "account:" });
  const accounts: Account[] = [];
  for (const key of list.keys) {
    const account = await env.TOOL_DATA.get<Account>(key.name, "json");
    if (account) {
      accounts.push(account);
    }
  }
  return accounts;
}

export async function getAccount(
  env: Env,
  id: string
): Promise<Account | null> {
  return env.TOOL_DATA.get<Account>(`account:${id}`, "json");
}

export async function setAccount(
  env: Env,
  account: Account
): Promise<void> {
  await env.TOOL_DATA.put(`account:${account.id}`, JSON.stringify(account));
}

export async function deleteAccount(
  env: Env,
  id: string
): Promise<void> {
  await env.TOOL_DATA.delete(`account:${id}`);
}
