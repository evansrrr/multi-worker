/**
 * GET /api/resources - Aggregate all Workers and Pages from all accounts
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

interface Worker {
  id: string;
  name: string;
  updated_on?: string;
  deployed_on?: string;
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

/**
 * Normalize the various "last modified" timestamps across Cloudflare APIs.
 * Workers Beta returns `updated_on` / `deployed_on`; classic scripts return
 * `modified_on`; Pages returns `modified_on` / `created_on`. Prefer the most
 * specific one and fall back gracefully so we never emit "Invalid Date".
 */
function pickModifiedOn(...candidates: Array<string | undefined>): string {
  for (const c of candidates) {
    if (c) return c;
  }
  return "";
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;

  const accounts = await getAccounts(env);
  const resources: Resource[] = [];

  const fetchPromises = accounts.map(async (account) => {
    const token = await getCloudflareToken(env, account.id);
    if (!token) return;

    // Use a generous per_page so the aggregate view is useful by default.
    const [workersResponse, pagesResponse] = await Promise.all([
      cloudflareFetch(
        token,
        `/accounts/${account.id}/workers/workers?page=1&per_page=100`
      ),
      cloudflareFetch(
        token,
        `/accounts/${account.id}/pages/projects?page=1&per_page=100`
      ),
    ]);

    const [workersData, pagesData] = await Promise.all([
      parseCfResponse<Worker[]>(workersResponse),
      parseCfResponse<PagesProject[]>(pagesResponse),
    ]);

    if (workersData.success && workersData.result) {
      for (const worker of workersData.result) {
        resources.push({
          name: worker.name,
          type: "worker",
          accountId: account.id,
          accountName: account.name,
          modifiedOn: pickModifiedOn(
            worker.updated_on,
            worker.deployed_on,
            worker.modified_on,
            worker.created_on
          ),
        });
      }
    }

    if (pagesData.success && pagesData.result) {
      for (const project of pagesData.result) {
        resources.push({
          name: project.name,
          type: "pages",
          accountId: account.id,
          accountName: account.name,
          modifiedOn: pickModifiedOn(
            project.modified_on,
            project.created_on
          ),
        });
      }
    }
  });

  await Promise.all(fetchPromises);

  return new Response(
    JSON.stringify({ resources }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
