/**
 * GET /api/resources - Aggregate all Workers and Pages from all accounts
 *
 * 关于分页（AUDIT H5 的收口）：
 * - Workers 走经典端点 `GET /accounts/{id}/workers/scripts`，该端点**不支持分页**
 *   （官方文档确认：唯一查询参数是 tags，响应也没有 result_info），因此它一次
 *   返回全部脚本，聚合不会截断。
 * - Pages 支持 `per_page`，会截断，所以截断标记只针对 Pages 统计。
 * 前端据此提示"部分账户资源较多，已截断展示"。
 */

import { getAccounts } from "../../lib/kv";
import {
  getCloudflareToken,
  cloudflareFetch,
  parseCfResponse,
} from "../../lib/cloudflare";

interface Env {
  TOOL_DATA: KVNamespace;
}

interface WorkerScript {
  id: string;
  created_on?: string;
  modified_on?: string;
}

interface PagesProject {
  id: string;
  name: string;
  modified_on?: string;
  created_on?: string;
}

interface Resource {
  name: string;
  type: "worker" | "pages";
  accountId: string;
  accountName: string;
  modifiedOn: string;
}

/** 聚合时每个账户最多拉取多少 Pages 项目 */
const PER_ACCOUNT_LIMIT = 100;
/** 同时拉取的账户数上限，避免账户多时把 CF 速率限制打满 */
const ACCOUNT_CONCURRENCY = 5;

/**
 * Normalize the various "last modified" timestamps across Cloudflare APIs.
 * Classic Workers scripts return `created_on` / `modified_on`; Pages returns
 * `modified_on` / `created_on`. Prefer the most specific one and fall back
 * gracefully so we never emit "Invalid Date".
 */
function pickModifiedOn(...candidates: Array<string | undefined>): string {
  for (const c of candidates) {
    if (c) return c;
  }
  return "";
}

/**
 * 有限并发的 map：任务数量受控，且不依赖外部库。
 * 账户列表可能很长，全并发既会触发 CF 速率限制也会拖长总耗时。
 */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
    }
  });

  await Promise.all(runners);
  return results;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;

  const accounts = await getAccounts(env);
  const resources: Resource[] = [];
  const truncatedAccounts: string[] = [];

  await mapLimit(accounts, ACCOUNT_CONCURRENCY, async (account) => {
    const token = await getCloudflareToken(env, account.id);
    if (!token) return;

    const [workersResponse, pagesResponse] = await Promise.all([
      // 经典端点不支持分页，也无需分页参数
      cloudflareFetch(token, `/accounts/${account.id}/workers/scripts`),
      cloudflareFetch(
        token,
        `/accounts/${account.id}/pages/projects?page=1&per_page=${PER_ACCOUNT_LIMIT}`
      ),
    ]);

    const [workersData, pagesData] = await Promise.all([
      parseCfResponse<WorkerScript[]>(workersResponse),
      parseCfResponse<PagesProject[]>(pagesResponse),
    ]);

    if (workersData.success && workersData.result) {
      for (const worker of workersData.result) {
        resources.push({
          name: worker.id,
          type: "worker",
          accountId: account.id,
          accountName: account.name,
          modifiedOn: pickModifiedOn(worker.modified_on, worker.created_on),
        });
      }
    }

    if (pagesData.success && pagesData.result) {
      const totalCount = pagesData.result_info?.total_count;
      if (totalCount != null && totalCount > pagesData.result.length) {
        truncatedAccounts.push(account.id);
      }
      for (const project of pagesData.result) {
        resources.push({
          name: project.name,
          type: "pages",
          accountId: account.id,
          accountName: account.name,
          modifiedOn: pickModifiedOn(project.modified_on, project.created_on),
        });
      }
    }
  });

  return new Response(
    JSON.stringify({
      resources,
      truncated: truncatedAccounts.length > 0,
      truncatedAccounts,
      perAccountLimit: PER_ACCOUNT_LIMIT,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
