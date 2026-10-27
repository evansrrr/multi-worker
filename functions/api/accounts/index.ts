/**
 * GET  /api/accounts - 列出已保存的账户
 * POST /api/accounts - 用一个 token 导入一个或多个账户
 *
 * 原实现固定取 Cloudflare `GET /accounts` 的 `result[0]`，一个 token 授权多个
 * 账户时只能加进来一个（M4）。现在改为：预检走 POST /api/accounts/preview，
 * 本端点按前端勾选的账户列表批量写入；不传 accounts 即“导入全部”。
 */

import { getAccounts, setAccount, type Account } from "../../lib/kv";
import {
  ensureEncryptionKey,
  resolveEncryptionKey,
  encryptData,
} from "../../lib/crypto";
import {
  cfListAccounts,
  cfGetUserEmail,
  isValidAccountId,
  json,
  toSafeAccount,
  type CfAccount,
  type SafeAccount,
} from "../../lib/accounts";

interface Env {
  TOOL_DATA: KVNamespace;
  TOKEN_ENC_KEY?: string;
  ENCRYPTION_KEY_SOURCE?: string;
}

interface AddAccountsBody {
  token?: unknown;
  /** 兼容单账户场景的别名；同时导入多个账户时被忽略。 */
  name?: unknown;
  /** 要导入的账户；省略或为空数组表示导入该 token 可见的全部账户。 */
  accounts?: Array<{ id?: unknown; name?: unknown }>;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;
  const accounts = await getAccounts(env);

  // 不返回加密令牌等敏感字段
  return json({ accounts: accounts.map(toSafeAccount) });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env } = context;

  let body: AddAccountsBody;
  try {
    body = await context.request.json<AddAccountsBody>();
  } catch {
    return json({ error: "请求体不是合法的 JSON" }, 400);
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) {
    return json({ error: "Token is required" }, 400);
  }

  // Cloudflare 的 GET /accounts 同时回答两件事：令牌是否有效、它可见哪些账户。
  // 不用 GET /user——那需要 User 级权限，Account 级 token 会被误判为无效。
  const listed = await cfListAccounts(token);
  if (!listed.ok || !listed.result) {
    return json(
      {
        error: `Token verification failed: ${listed.reason}`,
        hint: "请到 https://dash.cloudflare.com/profile/api-tokens 创建具备 'Account - Workers' 或 'All Resources' 权限的 API Token",
      },
      400
    );
  }
  const cfAccounts = listed.result;

  // 选出本次要导入的账户：accounts 缺省 = 导入全部
  const selected: Array<{ cf: CfAccount; alias?: string }> = [];
  const skipped: Array<{ id: string; reason: string }> = [];
  const requested = Array.isArray(body.accounts) ? body.accounts : null;

  if (requested && requested.length > 0) {
    for (const item of requested) {
      const rawId = typeof item?.id === "string" ? item.id.trim() : "";
      if (!isValidAccountId(rawId)) {
        skipped.push({ id: rawId || "(空)", reason: "账户 ID 格式非法" });
        continue;
      }
      const cf = cfAccounts.find((a) => a.id === rawId);
      if (!cf) {
        skipped.push({ id: rawId, reason: "该 token 看不到此账户" });
        continue;
      }
      selected.push({
        cf,
        alias: typeof item?.name === "string" ? item.name : undefined,
      });
    }
  } else {
    for (const cf of cfAccounts) {
      selected.push({ cf });
    }
  }

  if (selected.length === 0) {
    const error =
      requested && requested.length > 0
        ? "所选账户均无法导入"
        : "No accounts found for this token";
    return json({ error, skipped }, 400);
  }

  await ensureEncryptionKey(env);
  const encryptionKey = await resolveEncryptionKey(env);
  if (!encryptionKey) {
    return json({ error: "加密密钥不可用，无法保存令牌" }, 500);
  }

  // 已存在的账户按 id 覆盖；保留用户改过的别名
  const existingById = new Map(
    (await getAccounts(env)).map((a) => [a.id, a] as const)
  );
  const singleAlias =
    selected.length === 1 && typeof body.name === "string"
      ? body.name
      : undefined;
  const email = await cfGetUserEmail(token); // 仅 User 级 token 能取到，取不到留空

  const saved: SafeAccount[] = [];
  const updated: string[] = [];

  for (const { cf, alias } of selected) {
    // 每个账户单独加密：AES-GCM 的 IV 不可在相同密钥下复用
    const { encrypted, iv } = await encryptData(token, encryptionKey);
    const previous = existingById.get(cf.id);
    const customName = (alias ?? singleAlias)?.trim();

    const account: Account = {
      id: cf.id,
      name: customName || previous?.name || cf.name,
      type: cf.type,
      email: email || previous?.email || "",
      encryptedToken: encrypted,
      iv,
    };

    await setAccount(env, account);
    saved.push(toSafeAccount(account));
    if (previous) updated.push(cf.id);
  }

  return json({ accounts: saved, updated, skipped }, 201);
};
