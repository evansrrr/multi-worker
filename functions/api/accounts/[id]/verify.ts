/**
 * POST /api/accounts/:id/verify - Verify token works
 */

import { getAccount, getConfig, type Account } from "../../../lib/kv";
import { decryptData } from "../../../lib/crypto";

interface Env {
  TOOL_DATA: KVNamespace;
}

const CF_API_BASE = "https://api.cloudflare.com/client/v4";

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, params } = context;
  const id = params.id as string;

  const account = await getAccount(env, id);
  if (!account) {
    return new Response(
      JSON.stringify({ error: "Account not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  // Get encryption key and decrypt token
  const encryptionKey = await getConfig(env, "encryption_key");
  if (!encryptionKey) {
    return new Response(
      JSON.stringify({ error: "Encryption key not found" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const token = await decryptData(
      account.encryptedToken,
      account.iv,
      encryptionKey
    );

    // Verify token by calling Cloudflare API
    const verifyResponse = await fetch(`${CF_API_BASE}/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
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
        verifyData.errors?.[0]?.message || "Token verification failed";
      return new Response(
        JSON.stringify({
          valid: false,
          error: errorMessage,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        valid: true,
        email: verifyData.result?.email,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch {
    return new Response(
      JSON.stringify({
        valid: false,
        error: "Failed to decrypt token",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
};
