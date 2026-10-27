/**
 * Cloudflare API utilities for managing Workers, Pages, and other resources.
 */

import { getAccount } from "./kv";
import { decryptData, resolveEncryptionKey } from "./crypto";

const CF_API_BASE = "https://api.cloudflare.com/client/v4";

interface Env {
  TOOL_DATA: KVNamespace;
  TOKEN_ENC_KEY?: string;
  ENCRYPTION_KEY_SOURCE?: string;
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

  const encryptionKey = await resolveEncryptionKey(env);
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
 *
 * Content-Type is only injected for JSON bodies (string or plain object).
 * FormData/Blob/ArrayBuffer bodies must set their own headers (or none at
 * all, so fetch can generate the multipart boundary); injecting
 * "application/json" for them corrupts the request.
 */
export async function cloudflareFetch(
  token: string,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${token}`);

  const body = options.body;
  const isJsonBody =
    typeof body === "string" ||
    (body != null &&
      typeof body === "object" &&
      !(body instanceof FormData) &&
      !(body instanceof Blob) &&
      !(body instanceof ArrayBuffer) &&
      !(body instanceof URLSearchParams) &&
      !(typeof ReadableStream !== "undefined" && body instanceof ReadableStream));

  if (isJsonBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(`${CF_API_BASE}${path}`, {
    ...options,
    headers,
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
  const contentType = response.headers.get("Content-Type") ?? "";
  if (!contentType.includes("json")) {
    const text = await response.text();
    throw new Error(
      `Cloudflare API returned non-JSON response (status ${response.status}): ${text.slice(0, 200)}`
    );
  }
  const data = await response.json<CfApiResponse<T>>();
  return data;
}
