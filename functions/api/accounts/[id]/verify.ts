/**
 * POST /api/accounts/:id/verify - 用已保存的 token 重新校验账户是否仍然可用
 *
 * 不使用 `GET /user`：它要求 User 级权限，仅有 Account 级权限的 token 会全部
 * 误报失败。改为：
 *   1. `GET /accounts/{id}`            账户详情 —— 校验目标账户对该 token 可读
 *   2. `GET /accounts/{id}/workers/scripts?per_page=1` 轻量探针 —— 校验具备实际资源读取权限
 * 见 `Cloudflare API Doc/Account & User Management/Accounts.md`。
 */

import { getAccount } from "../../../lib/kv";
import { decryptData, resolveEncryptionKey } from "../../../lib/crypto";
import {
  cfGetAccount,
  cfProbeWorkersRead,
  isValidAccountId,
  json,
} from "../../../lib/accounts";

interface Env {
  TOOL_DATA: KVNamespace;
  TOKEN_ENC_KEY?: string;
  ENCRYPTION_KEY_SOURCE?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, params } = context;
  const id = params.id as string;
  if (!isValidAccountId(id)) {
    return json({ error: "账户 ID 格式非法" }, 400);
  }

  const account = await getAccount(env, id);
  if (!account) {
    return json({ error: "Account not found" }, 404);
  }

  const encryptionKey = await resolveEncryptionKey(env);
  if (!encryptionKey) {
    return json({ error: "加密密钥不可用，无法解密已保存的令牌" }, 500);
  }

  let token: string;
  try {
    token = await decryptData(
      account.encryptedToken,
      account.iv,
      encryptionKey
    );
  } catch {
    return json(
      { error: "无法解密已保存的令牌，请删除后重新添加该账户" },
      500
    );
  }

  const detail = await cfGetAccount(token, id);
  if (!detail.ok || !detail.result) {
    return json({
      ok: false,
      accountId: id,
      alias: account.name,
      permissions: { accountRead: false, workersRead: false },
      reason: detail.reason ?? "账户校验失败",
    });
  }

  const accountName = detail.result.name;
  const probe = await cfProbeWorkersRead(token, id);

  if (!probe.ok) {
    return json({
      ok: false,
      accountId: id,
      accountName,
      alias: account.name,
      permissions: { accountRead: true, workersRead: false },
      reason: `权限不足: 该 token 无此账户的 Workers 读取权限${
        probe.reason ? `（${probe.reason}）` : ""
      }`,
    });
  }

  return json({
    ok: true,
    accountId: id,
    accountName,
    alias: account.name,
    permissions: { accountRead: true, workersRead: true },
  });
};
