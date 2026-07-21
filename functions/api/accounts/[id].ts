/**
 * DELETE /api/accounts/:id - Remove account
 */

import { deleteAccount, getAccount } from "../../lib/kv";

interface Env {
  TOOL_DATA: KVNamespace;
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { env, params } = context;
  const id = params.id as string;

  const account = await getAccount(env, id);
  if (!account) {
    return new Response(
      JSON.stringify({ error: "Account not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  await deleteAccount(env, id);

  return new Response(
    JSON.stringify({ success: true, id }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
