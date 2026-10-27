/**
 * PUT    /api/accounts/:id - 修改账户展示别名
 * DELETE /api/accounts/:id - 删除账户
 *
 * 账户 id 是 Cloudflare 账户 ID，不可变；只有展示别名（name）可改。
 */

import { deleteAccount, getAccount, setAccount } from "../../lib/kv";
import { isValidAccountId, json, toSafeAccount } from "../../lib/accounts";

interface Env {
  TOOL_DATA: KVNamespace;
}

const NAME_MAX_LENGTH = 100;

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { env, params } = context;
  const id = params.id as string;
  if (!isValidAccountId(id)) {
    return json({ error: "账户 ID 格式非法" }, 400);
  }

  const account = await getAccount(env, id);
  if (!account) {
    return json({ error: "Account not found" }, 404);
  }

  let body: { name?: unknown };
  try {
    body = await context.request.json<{ name?: unknown }>();
  } catch {
    return json({ error: "请求体不是合法的 JSON" }, 400);
  }

  if (typeof body?.name !== "string") {
    return json({ error: "缺少别名字段 name" }, 400);
  }
  const name = body.name.trim();
  if (!name) {
    return json({ error: "别名不能为空" }, 400);
  }
  if (name.length > NAME_MAX_LENGTH) {
    return json({ error: `别名长度不能超过 ${NAME_MAX_LENGTH} 个字符` }, 400);
  }

  // 只改别名，其余字段（含加密令牌）原样保留
  const updated = { ...account, name };
  await setAccount(env, updated);

  return json({ account: toSafeAccount(updated) });
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { env, params } = context;
  const id = params.id as string;
  if (!isValidAccountId(id)) {
    return json({ error: "账户 ID 格式非法" }, 400);
  }

  const account = await getAccount(env, id);
  if (!account) {
    return json({ error: "Account not found" }, 404);
  }

  await deleteAccount(env, id);

  return json({ success: true, id });
};
