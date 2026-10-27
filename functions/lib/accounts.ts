/**
 * 账户相关的通用逻辑：账户 ID 校验、Cloudflare 账户读取、安全字段投影。
 *
 * API 依据 `Cloudflare API Doc/Account & User Management/Accounts.md`：
 * - `GET /accounts`      列出 token 可见的**全部**账户（原实现只取 `result[0]`，见 M4）
 * - `GET /accounts/{id}` 账户详情，Account 级权限的 token 也能通过（不像 `/user`
 *                        只对 User 级 token 有效，会误报失败）
 * - `PUT  /accounts/{id}` 仅租户管理员可用，本项目不调用它——展示别名存在本地 KV
 */

import { cloudflareFetch, parseCfResponse } from "./cloudflare";
import type { Account } from "./kv";

/**
 * 账户 ID 白名单。Cloudflare 账户 ID 是 32 位十六进制串，这里放宽到常见标识
 * 字符并限制长度，用于拦截 URL 路径里的 `..`、`/`、`%2e%2e` 等注入。
 */
const ACCOUNT_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export function isValidAccountId(id: unknown): id is string {
  return typeof id === "string" && ACCOUNT_ID_PATTERN.test(id);
}

/** 统一构造 JSON 响应。 */
export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** 对外返回的账户结构：不含 encryptedToken / iv。 */
export interface SafeAccount {
  id: string;
  name: string;
  type: string;
  email: string;
}

export function toSafeAccount({
  id,
  name,
  type,
  email,
}: Account): SafeAccount {
  return { id, name, type, email };
}

/** Cloudflare `/accounts` 返回的账户对象（只取本项目用到的字段）。 */
export interface CfAccount {
  id: string;
  name: string;
  type: string;
}

/**
 * 一次 Cloudflare 调用的结果。`reason` 是可直接展示给中文用户的失败原因，
 * 成功时为 undefined。
 */
export interface CfCallResult<T> {
  ok: boolean;
  result?: T;
  reason?: string;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function failureReason(status: number, cfMessage?: string): string {
  const suffix = cfMessage ? `（${cfMessage}）` : "";
  if (status === 401) return `令牌无效或已过期${suffix}`;
  if (status === 403) return `权限不足：该 token 未被授予此操作${suffix}`;
  if (status === 404) return `资源不存在，或该 token 看不到它${suffix}`;
  return `Cloudflare API 调用失败（HTTP ${status}）${suffix}`;
}

async function callCf<T>(
  token: string,
  path: string
): Promise<CfCallResult<T>> {
  let response: Response;
  try {
    response = await cloudflareFetch(token, path);
  } catch (error) {
    return {
      ok: false,
      reason: `无法连接 Cloudflare API：${describeError(error)}`,
    };
  }

  let data: Awaited<ReturnType<typeof parseCfResponse<T>>>;
  try {
    data = await parseCfResponse<T>(response);
  } catch (error) {
    return {
      ok: false,
      reason: `Cloudflare 返回了无法解析的响应（HTTP ${response.status}）：${describeError(error)}`,
    };
  }

  if (!response.ok || !data.success) {
    return {
      ok: false,
      reason: failureReason(response.status, data.errors?.[0]?.message),
    };
  }
  return { ok: true, result: data.result };
}

/** 列出 token 可见的全部账户（Accounts.md: List Accounts）。 */
export async function cfListAccounts(
  token: string
): Promise<CfCallResult<CfAccount[]>> {
  const result = await callCf<CfAccount[]>(token, "/accounts");
  if (!result.ok) return result;
  const accounts = Array.isArray(result.result) ? result.result : [];
  if (accounts.length === 0) {
    return { ok: false, reason: "该 token 看不到任何账户" };
  }
  return { ok: true, result: accounts };
}

/** 读取单个账户详情（Accounts.md: Account Details）。 */
export async function cfGetAccount(
  token: string,
  accountId: string
): Promise<CfCallResult<CfAccount>> {
  const result = await callCf<CfAccount>(token, `/accounts/${accountId}`);
  if (!result.ok) return result;
  if (!result.result?.id) {
    return { ok: false, reason: "账户不存在，或该 token 无此账户的访问权限" };
  }
  return result;
}

/** 轻量探针：验证 token 具备该账户 Workers 资源的读取权限。 */
export async function cfProbeWorkersRead(
  token: string,
  accountId: string
): Promise<CfCallResult<unknown>> {
  return callCf<unknown>(
    token,
    `/accounts/${accountId}/workers/scripts?per_page=1`
  );
}

/**
 * 读取 token 所属用户邮箱。只有 User 级权限的 token 能成功，Account 级 token
 * 失败时返回空串——邮箱只是展示信息，不能因为它判定令牌无效。
 */
export async function cfGetUserEmail(token: string): Promise<string> {
  const result = await callCf<{ email?: string }>(token, "/user");
  if (!result.ok) return "";
  return result.result?.email ?? "";
}
