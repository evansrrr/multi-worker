/**
 * KV storage utilities for configuration and sessions.
 */

const SESSION_EXPIRY_SECONDS = 24 * 60 * 60; // 24 hours

interface Env {
  TOOL_DATA: KVNamespace;
}

export async function getConfig(env: Env, key: string): Promise<string | null> {
  return env.TOOL_DATA.get(`config:${key}`);
}

export async function setConfig(
  env: Env,
  key: string,
  value: string
): Promise<void> {
  await env.TOOL_DATA.put(`config:${key}`, value);
}

export async function getSession(
  env: Env,
  sessionId: string
): Promise<string | null> {
  return env.TOOL_DATA.get(`session:${sessionId}`);
}

export async function setSession(
  env: Env,
  sessionId: string,
  accountId: string
): Promise<void> {
  await env.TOOL_DATA.put(`session:${sessionId}`, accountId, {
    expirationTtl: SESSION_EXPIRY_SECONDS,
  });
}

export async function deleteSession(
  env: Env,
  sessionId: string
): Promise<void> {
  await env.TOOL_DATA.delete(`session:${sessionId}`);
}
