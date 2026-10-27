/**
 * POST /api/settings/migrate-encryption - One-time migration of stored
 * account tokens from the legacy KV encryption key to the Worker Secret
 * TOKEN_ENC_KEY. Requires a login session (enforced by _middleware).
 *
 * The old key is backed up to config:encryption_key_backup before any record
 * is rewritten, and config:encryption_key is only deleted after every record
 * has been re-encrypted successfully. A failure aborts loudly with the
 * affected account instead of passing silently half-migrated.
 */

import { decryptData, encryptData } from "../../lib/crypto";
import { setConfig } from "../../lib/kv";
import type { Account } from "../../lib/kv";

interface Env {
  TOOL_DATA: KVNamespace;
  TOKEN_ENC_KEY?: string;
  ENCRYPTION_KEY_SOURCE?: string;
}

const KV_ENCRYPTION_KEY = "config:encryption_key";

function errorResponse(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function successResponse(migrated: number, message: string): Response {
  return new Response(
    JSON.stringify({ success: true, migrated, message }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env } = context;

  // Rollback switch: "kv" keeps the legacy key, migration is disabled.
  if (env.ENCRYPTION_KEY_SOURCE === "kv") {
    return errorResponse("当前 ENCRYPTION_KEY_SOURCE=kv（回滚模式），已停用密钥迁移");
  }

  const newKey = env.TOKEN_ENC_KEY;
  if (!newKey) {
    return errorResponse("未配置 Worker Secret TOKEN_ENC_KEY，无法迁移加密密钥");
  }

  // Fail fast on a malformed secret before touching any stored record.
  try {
    await encryptData("probe", newKey);
  } catch {
    return errorResponse("TOKEN_ENC_KEY 无效：应为 base64 编码的 256 位 AES 密钥");
  }

  // Collect every account record (KV list is paginated).
  const records: Array<{ keyName: string; account: Account }> = [];
  let cursor: string | undefined;
  do {
    const page = await env.TOOL_DATA.list({ prefix: "account:", cursor });
    for (const key of page.keys) {
      const account = await env.TOOL_DATA.get<Account>(key.name, "json");
      if (account) {
        records.push({ keyName: key.name, account });
      }
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  const oldKey = await env.TOOL_DATA.get(KV_ENCRYPTION_KEY);

  if (!oldKey) {
    if (records.length === 0) {
      // Nothing stored yet: nothing to migrate (keeps the endpoint idempotent).
      return successResponse(0, "没有需要迁移的账户记录");
    }
    return errorResponse(
      `存在 ${records.length} 条账户记录但缺少旧加密密钥（config:encryption_key），无法解密迁移`,
      500
    );
  }

  // Phase 1: decrypt everything with the old key first. Abort before any
  // write if a single record cannot be decrypted.
  const decrypted: Array<{ keyName: string; account: Account; token: string }> =
    [];
  for (const record of records) {
    try {
      const token = await decryptData(
        record.account.encryptedToken,
        record.account.iv,
        oldKey
      );
      decrypted.push({ ...record, token });
    } catch {
      return errorResponse(
        `账户「${record.account.name || record.account.id}」无法用旧密钥解密，迁移已中止，未修改任何数据`,
        500
      );
    }
  }

  // Back up the old key before rewriting so the run can be rolled back.
  await setConfig(env, "encryption_key_backup", oldKey);

  // Phase 2: re-encrypt with the Worker Secret and write back.
  let migrated = 0;
  for (const record of decrypted) {
    const { encrypted, iv } = await encryptData(record.token, newKey);
    const updated: Account = {
      ...record.account,
      encryptedToken: encrypted,
      iv,
    };
    try {
      await env.TOOL_DATA.put(record.keyName, JSON.stringify(updated));
    } catch {
      return errorResponse(
        `写入账户「${record.account.name || record.account.id}」失败，迁移中止。` +
          `旧密钥已备份到 config:encryption_key_backup，可设置 ENCRYPTION_KEY_SOURCE=kv 回滚`,
        500
      );
    }
    migrated += 1;
  }

  // Phase 3: only now drop the primary KV key.
  await env.TOOL_DATA.delete(KV_ENCRYPTION_KEY);

  return successResponse(
    migrated,
    `已迁移 ${migrated} 个账户的令牌加密至 TOKEN_ENC_KEY`
  );
};
