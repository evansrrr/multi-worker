/**
 * Cloudflare API utilities for managing Workers, Pages, and other resources.
 */

import { getAccount, getConfig } from "./kv";
import { decryptData } from "./crypto";

const CF_API_BASE = "https://api.cloudflare.com/client/v4";

interface Env {
  TOOL_DATA: KVNamespace;
}

/**
 * Get decrypted Cloudflare API token for an account.
 */
export async function getCloudflareToken(
  env: Env,
  accountId: string
): Promise<string | null> {
  const account = await getAccount(env, accountId);
  if (!account) return null;

  const encryptionKey = await getConfig(env, "encryption_key");
  if (!encryptionKey) return null;

  try {
    const token = await decryptData(
      account.encryptedToken,
      account.iv,
      encryptionKey
    );
    return token;
  } catch {
    return null;
  }
}

/**
 * Make an authenticated request to the Cloudflare API.
 */
export async function cloudflareFetch(
  token: string,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(`${CF_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
}

/**
 * Parse Cloudflare API response.
 */
export interface CfApiResponse<T = unknown> {
  success: boolean;
  result: T;
  errors: Array<{ code: number; message: string }>;
  messages: Array<{ code: number; message: string }>;
}

export async function parseCfResponse<T>(
  response: Response
): Promise<CfApiResponse<T>> {
  const data = await response.json<CfApiResponse<T>>();
  return data;
}
