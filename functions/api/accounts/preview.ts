/**
 * POST /api/accounts/preview - 预检 token，返回它可见的全部账户（不写入任何数据）
 *
 * 添加账户的第一步：前端拿返回的列表让用户勾选，再 POST /api/accounts 批量导入。
 * 静态路由 `preview` 优先于动态路由 `[id]`，不会与 DELETE /api/accounts/:id 冲突。
 */

import { getAccounts } from "../../lib/kv";
import { cfListAccounts, json } from "../../lib/accounts";

interface Env {
  TOOL_DATA: KVNamespace;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env } = context;

  let body: { token?: unknown };
  try {
    body = await context.request.json<{ token?: unknown }>();
  } catch {
    return json({ error: "请求体不是合法的 JSON" }, 400);
  }

  const token = typeof body?.token === "string" ? body.token.trim() : "";
  if (!token) {
    return json({ error: "Token is required" }, 400);
  }

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

  // 已导入的账户标记出来，前端可提示“重复导入会覆盖凭据”
  const existingIds = new Set((await getAccounts(env)).map((a) => a.id));
  const accounts = listed.result.map(({ id, name, type }) => ({
    id,
    name,
    type,
    alreadyAdded: existingIds.has(id),
  }));

  return json({ accounts });
};
