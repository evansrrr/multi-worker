/**
 * GET /api/accounts - List all accounts
 * POST /api/accounts - Add new account (with token)
 */

import {
  getAccounts,
  setAccount,
  getAccount,
  getConfig,
  setConfig,
  type Account,
} from "../../lib/kv";
import { encryptData, generateEncryptionKey } from "../../lib/crypto";

interface Env {
  TOOL_DATA: KVNamespace;
}

// Cloudflare API base URL
const CF_API_BASE = "https://api.cloudflare.com/client/v4";

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;
  const accounts = await getAccounts(env);

  // Return accounts without sensitive token data
  const safeAccounts = accounts.map(({ encryptedToken, iv, ...rest }) => rest);

  return new Response(
    JSON.stringify({ accounts: safeAccounts }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env } = context;

  const body = await context.request.json<{ token: string; name?: string }>();
  if (!body.token) {
    return new Response(
      JSON.stringify({ error: "Token is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Verify token works by calling Cloudflare API
  const verifyResponse = await fetch(`${CF_API_BASE}/user`, {
    headers: {
      Authorization: `Bearer ${body.token}`,
      "Content-Type": "application/json",
    },
  });

  const verifyData = await verifyResponse.json<{
    success: boolean;
    result?: { email: string };
    errors?: Array<{ message: string }>;
  }>();

  if (!verifyData.success) {
    const errorMessage =
      verifyData.errors?.[0]?.message || "Invalid token";
    return new Response(
      JSON.stringify({ error: `Token verification failed: ${errorMessage}` }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Get account details
  const accountsResponse = await fetch(`${CF_API_BASE}/accounts`, {
    headers: {
      Authorization: `Bearer ${body.token}`,
      "Content-Type": "application/json",
    },
  });

  const accountsData = await accountsResponse.json<{
    success: boolean;
    result?: Array<{
      id: string;
      name: string;
      type: string;
    }>;
  }>();

  if (!accountsData.success || !accountsData.result?.length) {
    return new Response(
      JSON.stringify({ error: "No accounts found for this token" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const cfAccount = accountsData.result[0];
  const accountName = body.name || cfAccount.name;

  // Get or generate encryption key
  let encryptionKey = await getConfig(env, "encryption_key");
  if (!encryptionKey) {
    encryptionKey = await generateEncryptionKey();
    await setConfig(env, "encryption_key", encryptionKey);
  }

  // Encrypt the token
  const { encrypted, iv } = await encryptData(body.token, encryptionKey);

  const account: Account = {
    id: cfAccount.id,
    name: accountName,
    type: cfAccount.type,
    email: verifyData.result?.email || "",
    encryptedToken: encrypted,
    iv: iv,
  };

  await setAccount(env, account);

  // Return account without sensitive data
  const { encryptedToken, iv: _, ...safeAccount } = account;

  return new Response(
    JSON.stringify({ account: safeAccount }),
    { status: 201, headers: { "Content-Type": "application/json" } }
  );
};
