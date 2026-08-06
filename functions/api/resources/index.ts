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
  modified_on: string;
}

interface PagesProject {
  id: string;
  name: string;
  modified_on: string;
}

interface Resource {
  name: string;
  type: "worker" | "pages";
  accountId: string;
  accountName: string;
  modifiedOn: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;

  const accounts = await getAccounts(env);
  const resources: Resource[] = [];

  const fetchPromises = accounts.map(async (account) => {
    const token = await getCloudflareToken(env, account.id);
    if (!token) return;

    const [workersResponse, pagesResponse] = await Promise.all([
      cloudflareFetch(token, `/accounts/${account.id}/workers/workers`),
      cloudflareFetch(token, `/accounts/${account.id}/pages/projects`),
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
          modifiedOn: worker.modified_on,
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
          modifiedOn: project.modified_on,
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
