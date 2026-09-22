var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// lib/kv.ts
var SESSION_EXPIRY_SECONDS = 24 * 60 * 60;
async function getConfig(env, key) {
  return env.TOOL_DATA.get(`config:${key}`);
}
__name(getConfig, "getConfig");
async function setConfig(env, key, value) {
  await env.TOOL_DATA.put(`config:${key}`, value);
}
__name(setConfig, "setConfig");
async function getSession(env, sessionId) {
  return env.TOOL_DATA.get(`session:${sessionId}`);
}
__name(getSession, "getSession");
async function setSession(env, sessionId, accountId) {
  await env.TOOL_DATA.put(`session:${sessionId}`, accountId, {
    expirationTtl: SESSION_EXPIRY_SECONDS
  });
}
__name(setSession, "setSession");
async function deleteSession(env, sessionId) {
  await env.TOOL_DATA.delete(`session:${sessionId}`);
}
__name(deleteSession, "deleteSession");
async function getAccounts(env) {
  const list = await env.TOOL_DATA.list({ prefix: "account:" });
  const accounts = [];
  for (const key of list.keys) {
    const account = await env.TOOL_DATA.get(key.name, "json");
    if (account) {
      accounts.push(account);
    }
  }
  return accounts;
}
__name(getAccounts, "getAccounts");
async function getAccount(env, id) {
  return env.TOOL_DATA.get(`account:${id}`, "json");
}
__name(getAccount, "getAccount");
async function setAccount(env, account) {
  await env.TOOL_DATA.put(`account:${account.id}`, JSON.stringify(account));
}
__name(setAccount, "setAccount");
async function deleteAccount(env, id) {
  await env.TOOL_DATA.delete(`account:${id}`);
}
__name(deleteAccount, "deleteAccount");

// lib/crypto.ts
var enc = new TextEncoder();
var dec = new TextDecoder();
async function hashPassword(password) {
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    enc.encode(password)
  );
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray).map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(hashPassword, "hashPassword");
async function verifyPassword(password, hash) {
  const computed = await hashPassword(password);
  return computed === hash;
}
__name(verifyPassword, "verifyPassword");
async function generateEncryptionKey() {
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
  const rawKey = await crypto.subtle.exportKey("raw", key);
  return btoa(String.fromCharCode(...new Uint8Array(rawKey)));
}
__name(generateEncryptionKey, "generateEncryptionKey");
async function importKey(keyBase64) {
  const rawKey = Uint8Array.from(atob(keyBase64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}
__name(importKey, "importKey");
async function encryptData(data, keyBase64) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await importKey(keyBase64);
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(data)
  );
  return {
    encrypted: btoa(String.fromCharCode(...new Uint8Array(encryptedBuffer))),
    iv: btoa(String.fromCharCode(...iv))
  };
}
__name(encryptData, "encryptData");
async function decryptData(encryptedBase64, ivBase64, keyBase64) {
  const encrypted = Uint8Array.from(
    atob(encryptedBase64),
    (c) => c.charCodeAt(0)
  );
  const iv = Uint8Array.from(atob(ivBase64), (c) => c.charCodeAt(0));
  const key = await importKey(keyBase64);
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    encrypted
  );
  return dec.decode(decryptedBuffer);
}
__name(decryptData, "decryptData");

// lib/cloudflare.ts
var CF_API_BASE = "https://api.cloudflare.com/client/v4";
async function getCloudflareToken(env, accountId) {
  const account = await getAccount(env, accountId);
  if (!account) return null;
  const encryptionKey = await getConfig(env, "encryption_key");
  if (!encryptionKey) return null;
  try {
    const token = await decryptData(
      account.encryptedToken,
      account.iv,
      encryptionKey
    );
    return token;
  } catch {
    return null;
  }
}
__name(getCloudflareToken, "getCloudflareToken");
async function cloudflareFetch(token, path, options = {}) {
  return fetch(`${CF_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers
    }
  });
}
__name(cloudflareFetch, "cloudflareFetch");
async function parseCfResponse(response) {
  const data = await response.json();
  return data;
}
__name(parseCfResponse, "parseCfResponse");

// api/accounts/[id]/kv/[namespace_id]/keys/[key].ts
var onRequestGet = /* @__PURE__ */ __name(async (context) => {
  const { env, params } = context;
  const accountId = params.id;
  const namespaceId = params.namespace_id;
  const key = params.key;
  const token = await getCloudflareToken(env, accountId);
  if (!token) {
    return new Response(
      JSON.stringify({ error: "Account not found or token invalid" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }
  const response = await cloudflareFetch(
    token,
    `/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${key}`
  );
  if (response.status === 404) {
    return new Response(
      JSON.stringify({ error: "Key not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }
  if (!response.ok) {
    const errorData = await response.json();
    const errorMessage = errorData.errors?.[0]?.message || "Failed to get KV value";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
  const value = await response.text();
  return new Response(
    JSON.stringify({ key, value }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}, "onRequestGet");
var onRequestPut = /* @__PURE__ */ __name(async (context) => {
  const { env, params } = context;
  const accountId = params.id;
  const namespaceId = params.namespace_id;
  const key = params.key;
  const token = await getCloudflareToken(env, accountId);
  if (!token) {
    return new Response(
      JSON.stringify({ error: "Account not found or token invalid" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }
  const body = await context.request.json();
  if (body.value === void 0) {
    return new Response(
      JSON.stringify({ error: "Value is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  const formData = new FormData();
  formData.append("value", body.value);
  if (body.expiration) {
    formData.append("expiration", body.expiration.toString());
  }
  if (body.expiration_ttl) {
    formData.append("expiration_ttl", body.expiration_ttl.toString());
  }
  if (body.metadata) {
    formData.append("metadata", JSON.stringify(body.metadata));
  }
  const response = await cloudflareFetch(
    token,
    `/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${key}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "multipart/form-data"
      },
      body: formData
    }
  );
  if (!response.ok) {
    const errorData = await response.json();
    const errorMessage = errorData.errors?.[0]?.message || "Failed to set KV value";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}, "onRequestPut");
var onRequestDelete = /* @__PURE__ */ __name(async (context) => {
  const { env, params } = context;
  const accountId = params.id;
  const namespaceId = params.namespace_id;
  const key = params.key;
  const token = await getCloudflareToken(env, accountId);
  if (!token) {
    return new Response(
      JSON.stringify({ error: "Account not found or token invalid" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }
  const response = await cloudflareFetch(
    token,
    `/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${key}`,
    {
      method: "DELETE"
    }
  );
  if (!response.ok) {
    const errorData = await response.json();
    const errorMessage = errorData.errors?.[0]?.message || "Failed to delete KV key";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}, "onRequestDelete");

// api/accounts/[id]/d1/[database_id]/query.ts
var onRequestPost = /* @__PURE__ */ __name(async (context) => {
  const { env, params } = context;
  const accountId = params.id;
  const databaseId = params.database_id;
  const token = await getCloudflareToken(env, accountId);
  if (!token) {
    return new Response(
      JSON.stringify({ error: "Account not found or token invalid" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }
  const body = await context.request.json();
  let queryBody;
  if (body.batch) {
    queryBody = { batch: body.batch };
  } else if (body.sql) {
    queryBody = { sql: body.sql, params: body.params };
  } else {
    return new Response(
      JSON.stringify({ error: "SQL query or batch is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  const response = await cloudflareFetch(
    token,
    `/accounts/${accountId}/d1/database/${databaseId}/query`,
    {
      method: "POST",
      body: JSON.stringify(queryBody)
    }
  );
  const data = await parseCfResponse(response);
  if (!data.success) {
    const errorMessage = data.errors?.[0]?.message || "Failed to execute query";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
  return new Response(
    JSON.stringify({ result: data.result }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}, "onRequestPost");

// api/accounts/[id]/d1/[database_id]/tables.ts
var onRequestGet2 = /* @__PURE__ */ __name(async (context) => {
  const { env, params } = context;
  const accountId = params.id;
  const databaseId = params.database_id;
  const token = await getCloudflareToken(env, accountId);
  if (!token) {
    return new Response(
      JSON.stringify({ error: "Account not found or token invalid" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }
  const response = await cloudflareFetch(
    token,
    `/accounts/${accountId}/d1/database/${databaseId}/query`,
    {
      method: "POST",
      body: JSON.stringify({
        sql: "SELECT name, type FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;"
      })
    }
  );
  const data = await parseCfResponse(response);
  if (!data.success) {
    const errorMessage = data.errors?.[0]?.message || "Failed to list tables";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
  const tables = data.result?.[0]?.results || [];
  return new Response(
    JSON.stringify({ tables }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}, "onRequestGet");

// api/accounts/[id]/kv/[namespace_id]/keys.ts
var onRequestGet3 = /* @__PURE__ */ __name(async (context) => {
  const { env, params } = context;
  const accountId = params.id;
  const namespaceId = params.namespace_id;
  const token = await getCloudflareToken(env, accountId);
  if (!token) {
    return new Response(
      JSON.stringify({ error: "Account not found or token invalid" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }
  const url = new URL(context.request.url);
  const limit = url.searchParams.get("limit") || "1000";
  const cursor = url.searchParams.get("cursor") || void 0;
  let path = `/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/keys?limit=${limit}`;
  if (cursor) {
    path += `&cursor=${cursor}`;
  }
  const response = await cloudflareFetch(token, path);
  const data = await parseCfResponse(response);
  if (!data.success) {
    const errorMessage = data.errors?.[0]?.message || "Failed to list KV keys";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
  return new Response(
    JSON.stringify(data.result),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}, "onRequestGet");

// api/accounts/[id]/pages/[name]/deploy.ts
var onRequestPost2 = /* @__PURE__ */ __name(async (context) => {
  const { env, params, request } = context;
  const accountId = params.id;
  const projectName = params.name;
  const token = await getCloudflareToken(env, accountId);
  if (!token) {
    return new Response(
      JSON.stringify({ error: "Account not found or token invalid" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }
  const formData = await request.formData();
  const file = formData.get("files");
  if (!file) {
    return new Response(
      JSON.stringify({ error: "No file provided" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  const uploadFormData = new FormData();
  uploadFormData.append("files", file);
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}/deployments`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: uploadFormData
    }
  );
  const data = await response.json();
  if (!data.success) {
    return new Response(
      JSON.stringify({
        error: data.errors[0]?.message || "Failed to deploy Pages project"
      }),
      { status: response.status, headers: { "Content-Type": "application/json" } }
    );
  }
  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}, "onRequestPost");

// api/accounts/[id]/workers/[name]/bindings/index.ts
var onRequestGet4 = /* @__PURE__ */ __name(async (context) => {
  const { env, params } = context;
  const accountId = params.id;
  const workerName = params.name;
  const token = await getCloudflareToken(env, accountId);
  if (!token) {
    return new Response(
      JSON.stringify({ error: "Account not found or token invalid" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }
  const response = await cloudflareFetch(
    token,
    `/accounts/${accountId}/workers/scripts/${workerName}/settings`
  );
  const data = await parseCfResponse(response);
  if (!data.success) {
    const errorMessage = data.errors?.[0]?.message || "Failed to get worker bindings";
    const status = response.status === 404 ? 404 : 502;
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status, headers: { "Content-Type": "application/json" } }
    );
  }
  return new Response(
    JSON.stringify({ bindings: data.result?.bindings || [] }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}, "onRequestGet");
var onRequestPut2 = /* @__PURE__ */ __name(async (context) => {
  const { env, params } = context;
  const accountId = params.id;
  const workerName = params.name;
  const token = await getCloudflareToken(env, accountId);
  if (!token) {
    return new Response(
      JSON.stringify({ error: "Account not found or token invalid" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }
  const body = await context.request.json();
  if (!body.bindings || !Array.isArray(body.bindings)) {
    return new Response(
      JSON.stringify({ error: "Bindings array is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  const response = await cloudflareFetch(
    token,
    `/accounts/${accountId}/workers/scripts/${workerName}/settings`,
    {
      method: "PATCH",
      body: JSON.stringify({
        bindings: body.bindings
      })
    }
  );
  const data = await parseCfResponse(response);
  if (!data.success) {
    const errorMessage = data.errors?.[0]?.message || "Failed to update worker bindings";
    const status = response.status === 404 ? 404 : 502;
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status, headers: { "Content-Type": "application/json" } }
    );
  }
  return new Response(
    JSON.stringify({ bindings: data.result?.bindings || [] }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}, "onRequestPut");

// api/accounts/[id]/workers/[name]/deploy.ts
var onRequestPost3 = /* @__PURE__ */ __name(async (context) => {
  const { env, params, request } = context;
  const accountId = params.id;
  const workerName = params.name;
  const token = await getCloudflareToken(env, accountId);
  if (!token) {
    return new Response(
      JSON.stringify({ error: "Account not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }
  const formData = await request.formData();
  const file = formData.get("files");
  if (!file) {
    return new Response(
      JSON.stringify({ error: "No file provided" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  const metadata = {
    main_module: "worker.js",
    bindings: [],
    compatibility_date: (/* @__PURE__ */ new Date()).toISOString().split("T")[0]
  };
  const uploadFormData = new FormData();
  uploadFormData.append("metadata", JSON.stringify(metadata));
  uploadFormData.append("worker.js", file);
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/workers/${workerName}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: uploadFormData
    }
  );
  const data = await response.json();
  if (!data.success) {
    return new Response(
      JSON.stringify({
        error: data.errors[0]?.message || "Failed to deploy worker"
      }),
      { status: response.status, headers: { "Content-Type": "application/json" } }
    );
  }
  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}, "onRequestPost");

// api/accounts/[id]/workers/[name]/settings.ts
var onRequestGet5 = /* @__PURE__ */ __name(async (context) => {
  const { env, params } = context;
  const accountId = params.id;
  const workerName = params.name;
  const token = await getCloudflareToken(env, accountId);
  if (!token) {
    return new Response(
      JSON.stringify({ error: "Account not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }
  const response = await cloudflareFetch(
    token,
    `/accounts/${accountId}/workers/scripts/${workerName}/settings`
  );
  const data = await parseCfResponse(response);
  if (!data.success) {
    return new Response(
      JSON.stringify({
        error: data.errors[0]?.message || "Failed to get worker settings"
      }),
      { status: response.status, headers: { "Content-Type": "application/json" } }
    );
  }
  return new Response(
    JSON.stringify({ settings: data.result }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}, "onRequestGet");

// api/accounts/[id]/d1/[database_id]/index.ts
var onRequestDelete2 = /* @__PURE__ */ __name(async (context) => {
  const { env, params } = context;
  const accountId = params.id;
  const databaseId = params.database_id;
  const token = await getCloudflareToken(env, accountId);
  if (!token) {
    return new Response(
      JSON.stringify({ error: "Account not found or token invalid" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }
  const response = await cloudflareFetch(
    token,
    `/accounts/${accountId}/d1/database/${databaseId}`,
    {
      method: "DELETE"
    }
  );
  if (!response.ok) {
    const errorData = await response.json();
    const errorMessage = errorData.errors?.[0]?.message || "Failed to delete D1 database";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}, "onRequestDelete");

// api/accounts/[id]/kv/[namespace_id]/index.ts
var onRequestDelete3 = /* @__PURE__ */ __name(async (context) => {
  const { env, params } = context;
  const accountId = params.id;
  const namespaceId = params.namespace_id;
  const token = await getCloudflareToken(env, accountId);
  if (!token) {
    return new Response(
      JSON.stringify({ error: "Account not found or token invalid" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }
  const response = await cloudflareFetch(
    token,
    `/accounts/${accountId}/storage/kv/namespaces/${namespaceId}`,
    {
      method: "DELETE"
    }
  );
  if (!response.ok) {
    const errorData = await response.json();
    const errorMessage = errorData.errors?.[0]?.message || "Failed to delete KV namespace";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}, "onRequestDelete");

// api/accounts/[id]/pages/[name].ts
var onRequestDelete4 = /* @__PURE__ */ __name(async (context) => {
  const { env, params } = context;
  const accountId = params.id;
  const projectName = params.name;
  const token = await getCloudflareToken(env, accountId);
  if (!token) {
    return new Response(
      JSON.stringify({ error: "Account not found or token invalid" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }
  const response = await cloudflareFetch(
    token,
    `/accounts/${accountId}/pages/projects/${projectName}`,
    {
      method: "DELETE"
    }
  );
  const data = await parseCfResponse(response);
  if (!data.success) {
    const errorMessage = data.errors?.[0]?.message || "Failed to delete Pages project";
    const status = response.status === 404 ? 404 : 502;
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status, headers: { "Content-Type": "application/json" } }
    );
  }
  return new Response(
    JSON.stringify({ success: true, name: projectName }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}, "onRequestDelete");

// api/accounts/[id]/pages/[name]/index.ts
var onRequestGet6 = /* @__PURE__ */ __name(async (context) => {
  const { env, params } = context;
  const accountId = params.id;
  const projectName = params.name;
  const token = await getCloudflareToken(env, accountId);
  if (!token) {
    return new Response(
      JSON.stringify({ error: "Account not found or token invalid" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }
  const response = await cloudflareFetch(
    token,
    `/accounts/${accountId}/pages/projects/${projectName}`
  );
  const data = await parseCfResponse(response);
  if (!data.success) {
    const errorMessage = data.errors?.[0]?.message || "Failed to get Pages project details";
    const status = response.status === 404 ? 404 : 502;
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status, headers: { "Content-Type": "application/json" } }
    );
  }
  return new Response(
    JSON.stringify({ project: data.result }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}, "onRequestGet");

// api/accounts/[id]/workers/[name].ts
var onRequestDelete5 = /* @__PURE__ */ __name(async (context) => {
  const { env, params } = context;
  const accountId = params.id;
  const workerName = params.name;
  const token = await getCloudflareToken(env, accountId);
  if (!token) {
    return new Response(
      JSON.stringify({ error: "Account not found or token invalid" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }
  const response = await cloudflareFetch(
    token,
    `/accounts/${accountId}/workers/workers/${workerName}`,
    {
      method: "DELETE"
    }
  );
  const data = await parseCfResponse(response);
  if (!data.success) {
    const errorMessage = data.errors?.[0]?.message || "Failed to delete worker";
    const status = response.status === 404 ? 404 : 502;
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status, headers: { "Content-Type": "application/json" } }
    );
  }
  return new Response(
    JSON.stringify({ success: true, name: workerName }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}, "onRequestDelete");

// api/accounts/[id]/workers/[name]/index.ts
var onRequestGet7 = /* @__PURE__ */ __name(async (context) => {
  const { env, params } = context;
  const accountId = params.id;
  const workerName = params.name;
  const token = await getCloudflareToken(env, accountId);
  if (!token) {
    return new Response(
      JSON.stringify({ error: "Account not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }
  const response = await cloudflareFetch(
    token,
    `/accounts/${accountId}/workers/workers/${workerName}`
  );
  const data = await parseCfResponse(response);
  if (!data.success) {
    return new Response(
      JSON.stringify({
        error: data.errors[0]?.message || "Failed to get worker details"
      }),
      { status: response.status, headers: { "Content-Type": "application/json" } }
    );
  }
  return new Response(
    JSON.stringify({ worker: data.result }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}, "onRequestGet");

// api/accounts/[id]/d1/index.ts
var onRequestGet8 = /* @__PURE__ */ __name(async (context) => {
  const { env, params } = context;
  const accountId = params.id;
  const token = await getCloudflareToken(env, accountId);
  if (!token) {
    return new Response(
      JSON.stringify({ error: "Account not found or token invalid" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }
  const url = new URL(context.request.url);
  const name = url.searchParams.get("name") || void 0;
  const page = url.searchParams.get("page") || void 0;
  const perPage = url.searchParams.get("per_page") || void 0;
  let path = `/accounts/${accountId}/d1/database?`;
  if (name) path += `name=${encodeURIComponent(name)}&`;
  if (page) path += `page=${page}&`;
  if (perPage) path += `per_page=${perPage}&`;
  path = path.replace(/[&?]$/, "");
  const response = await cloudflareFetch(token, path);
  const data = await parseCfResponse(response);
  if (!data.success) {
    const errorMessage = data.errors?.[0]?.message || "Failed to list D1 databases";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
  return new Response(
    JSON.stringify({ databases: data.result, result_info: data.result_info }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}, "onRequestGet");
var onRequestPost4 = /* @__PURE__ */ __name(async (context) => {
  const { env, params } = context;
  const accountId = params.id;
  const token = await getCloudflareToken(env, accountId);
  if (!token) {
    return new Response(
      JSON.stringify({ error: "Account not found or token invalid" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }
  const body = await context.request.json();
  if (!body.name) {
    return new Response(
      JSON.stringify({ error: "Database name is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  const response = await cloudflareFetch(
    token,
    `/accounts/${accountId}/d1/database`,
    {
      method: "POST",
      body: JSON.stringify({
        name: body.name,
        jurisdiction: body.jurisdiction,
        primary_location_hint: body.primary_location_hint
      })
    }
  );
  const data = await parseCfResponse(response);
  if (!data.success) {
    const errorMessage = data.errors?.[0]?.message || "Failed to create D1 database";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
  return new Response(
    JSON.stringify({ database: data.result }),
    { status: 201, headers: { "Content-Type": "application/json" } }
  );
}, "onRequestPost");

// api/accounts/[id]/kv/index.ts
var onRequestGet9 = /* @__PURE__ */ __name(async (context) => {
  const { env, params } = context;
  const accountId = params.id;
  const token = await getCloudflareToken(env, accountId);
  if (!token) {
    return new Response(
      JSON.stringify({ error: "Account not found or token invalid" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }
  const response = await cloudflareFetch(
    token,
    `/accounts/${accountId}/storage/kv/namespaces`
  );
  const data = await parseCfResponse(response);
  if (!data.success) {
    const errorMessage = data.errors?.[0]?.message || "Failed to list KV namespaces";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
  return new Response(
    JSON.stringify({ namespaces: data.result }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}, "onRequestGet");
var onRequestPost5 = /* @__PURE__ */ __name(async (context) => {
  const { env, params } = context;
  const accountId = params.id;
  const token = await getCloudflareToken(env, accountId);
  if (!token) {
    return new Response(
      JSON.stringify({ error: "Account not found or token invalid" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }
  const body = await context.request.json();
  if (!body.title) {
    return new Response(
      JSON.stringify({ error: "Namespace title is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  const response = await cloudflareFetch(
    token,
    `/accounts/${accountId}/storage/kv/namespaces`,
    {
      method: "POST",
      body: JSON.stringify({ title: body.title })
    }
  );
  const data = await parseCfResponse(response);
  if (!data.success) {
    const errorMessage = data.errors?.[0]?.message || "Failed to create KV namespace";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
  return new Response(
    JSON.stringify({ namespace: data.result }),
    { status: 201, headers: { "Content-Type": "application/json" } }
  );
}, "onRequestPost");

// api/accounts/[id]/pages/index.ts
var onRequestGet10 = /* @__PURE__ */ __name(async (context) => {
  const { env, params } = context;
  const accountId = params.id;
  const token = await getCloudflareToken(env, accountId);
  if (!token) {
    return new Response(
      JSON.stringify({ error: "Account not found or token invalid" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }
  const response = await cloudflareFetch(
    token,
    `/accounts/${accountId}/pages/projects`
  );
  const data = await parseCfResponse(response);
  if (!data.success) {
    const errorMessage = data.errors?.[0]?.message || "Failed to list Pages projects";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
  return new Response(
    JSON.stringify({ projects: data.result }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}, "onRequestGet");
var onRequestPost6 = /* @__PURE__ */ __name(async (context) => {
  const { env, params } = context;
  const accountId = params.id;
  const token = await getCloudflareToken(env, accountId);
  if (!token) {
    return new Response(
      JSON.stringify({ error: "Account not found or token invalid" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }
  const body = await context.request.json();
  if (!body.name) {
    return new Response(
      JSON.stringify({ error: "Project name is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  const projectData = {
    name: body.name
  };
  if (body.production_branch) {
    projectData.production_branch = body.production_branch;
  }
  const response = await cloudflareFetch(
    token,
    `/accounts/${accountId}/pages/projects`,
    {
      method: "POST",
      body: JSON.stringify(projectData)
    }
  );
  const data = await parseCfResponse(response);
  if (!data.success) {
    const errorMessage = data.errors?.[0]?.message || "Failed to create Pages project";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
  return new Response(
    JSON.stringify({ project: data.result }),
    { status: 201, headers: { "Content-Type": "application/json" } }
  );
}, "onRequestPost");

// api/accounts/[id]/verify.ts
var CF_API_BASE2 = "https://api.cloudflare.com/client/v4";
var onRequestPost7 = /* @__PURE__ */ __name(async (context) => {
  const { env, params } = context;
  const id = params.id;
  const account = await getAccount(env, id);
  if (!account) {
    return new Response(
      JSON.stringify({ error: "Account not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }
  const encryptionKey = await getConfig(env, "encryption_key");
  if (!encryptionKey) {
    return new Response(
      JSON.stringify({ error: "Encryption key not found" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
  try {
    const token = await decryptData(
      account.encryptedToken,
      account.iv,
      encryptionKey
    );
    const verifyResponse = await fetch(`${CF_API_BASE2}/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });
    const verifyData = await verifyResponse.json();
    if (!verifyData.success) {
      const errorMessage = verifyData.errors?.[0]?.message || "Token verification failed";
      return new Response(
        JSON.stringify({
          valid: false,
          error: errorMessage
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response(
      JSON.stringify({
        valid: true,
        email: verifyData.result?.email
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch {
    return new Response(
      JSON.stringify({
        valid: false,
        error: "Failed to decrypt token"
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
}, "onRequestPost");

// api/accounts/[id]/workers/index.ts
var onRequestGet11 = /* @__PURE__ */ __name(async (context) => {
  const { env, params } = context;
  const accountId = params.id;
  const token = await getCloudflareToken(env, accountId);
  if (!token) {
    return new Response(
      JSON.stringify({ error: "Account not found or token invalid" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }
  const response = await cloudflareFetch(
    token,
    `/accounts/${accountId}/workers/workers`
  );
  const data = await parseCfResponse(response);
  if (!data.success) {
    const errorMessage = data.errors?.[0]?.message || "Failed to list workers";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
  return new Response(
    JSON.stringify({ workers: data.result }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}, "onRequestGet");
var onRequestPost8 = /* @__PURE__ */ __name(async (context) => {
  const { env, params } = context;
  const accountId = params.id;
  const token = await getCloudflareToken(env, accountId);
  if (!token) {
    return new Response(
      JSON.stringify({ error: "Account not found or token invalid" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }
  const body = await context.request.json();
  if (!body.name) {
    return new Response(
      JSON.stringify({ error: "Worker name is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  const metadata = {
    main_module: "worker.js",
    compatibility_date: (/* @__PURE__ */ new Date()).toISOString().split("T")[0]
  };
  const formData = new FormData();
  formData.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" })
  );
  const script = body.script || `export default {
  async fetch(request) {
    return new Response("Hello from ${body.name}!");
  },
};`;
  formData.append(
    "worker.js",
    new Blob([script], { type: "application/javascript+module" }),
    "worker.js"
  );
  const response = await cloudflareFetch(
    token,
    `/accounts/${accountId}/workers/workers`,
    {
      method: "POST",
      headers: {
        "Content-Type": "multipart/form-data"
      },
      body: formData
    }
  );
  const data = await parseCfResponse(response);
  if (!data.success) {
    const errorMessage = data.errors?.[0]?.message || "Failed to create worker";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
  return new Response(
    JSON.stringify({ worker: data.result }),
    { status: 201, headers: { "Content-Type": "application/json" } }
  );
}, "onRequestPost");

// api/batch/delete.ts
var onRequestPost9 = /* @__PURE__ */ __name(async (context) => {
  const { env } = context;
  let body;
  try {
    body = await context.request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  if (!body.targets || !Array.isArray(body.targets) || body.targets.length === 0) {
    return new Response(
      JSON.stringify({ error: "targets array is required and must not be empty" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  const results = [];
  for (const target of body.targets) {
    const { accountId, name, type } = target;
    if (!accountId || !name || !type) {
      results.push({ name, success: false, error: "Missing required fields" });
      continue;
    }
    const token = await getCloudflareToken(env, accountId);
    if (!token) {
      results.push({ name, success: false, error: "Account not found or token invalid" });
      continue;
    }
    const apiPath = type === "worker" ? `/accounts/${accountId}/workers/workers/${name}` : `/accounts/${accountId}/pages/projects/${name}`;
    try {
      const response = await cloudflareFetch(token, apiPath, { method: "DELETE" });
      const data = await parseCfResponse(response);
      if (!data.success) {
        const errorMessage = data.errors?.[0]?.message || "Failed to delete";
        results.push({ name, success: false, error: errorMessage });
      } else {
        results.push({ name, success: true });
      }
    } catch (err) {
      results.push({ name, success: false, error: err.message || "Request failed" });
    }
  }
  return new Response(
    JSON.stringify({ results }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}, "onRequestPost");

// api/batch/deploy.ts
async function deployPages(token, accountId, name, zipBuffer) {
  const formData = new FormData();
  formData.append(
    "manifest",
    JSON.stringify({ "/": { "contentType": "application/zip" } })
  );
  formData.append(
    "files",
    new Blob([zipBuffer], { type: "application/zip" }),
    "deploy.zip"
  );
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${name}/deployments`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    }
  );
  const data = await res.json();
  if (!data.success) {
    return { success: false, error: data.errors?.[0]?.message || "Pages deploy failed" };
  }
  return { success: true };
}
__name(deployPages, "deployPages");
async function deployWorker(token, accountId, name, zipBuffer) {
  const formData = new FormData();
  formData.append(
    "metadata",
    new Blob(
      [
        JSON.stringify({
          main_module: "worker.js",
          compatibility_date: (/* @__PURE__ */ new Date()).toISOString().split("T")[0]
        })
      ],
      { type: "application/json" }
    )
  );
  formData.append(
    "worker.js",
    new Blob([zipBuffer], { type: "application/javascript+module" }),
    "worker.js"
  );
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/workers/${name}`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    }
  );
  const data = await res.json();
  if (!data.success) {
    return { success: false, error: data.errors?.[0]?.message || "Worker deploy failed" };
  }
  return { success: true };
}
__name(deployWorker, "deployWorker");
var onRequestPost10 = /* @__PURE__ */ __name(async (context) => {
  const { env } = context;
  let formData;
  try {
    formData = await context.request.formData();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid form data" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  const file = formData.get("files");
  if (!file || !(file instanceof File)) {
    return new Response(
      JSON.stringify({ error: "files field is required and must be a ZIP file" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  const targetsRaw = formData.get("targets");
  if (!targetsRaw || typeof targetsRaw !== "string") {
    return new Response(
      JSON.stringify({ error: "targets field is required and must be a JSON string" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  let targets;
  try {
    targets = JSON.parse(targetsRaw);
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid targets JSON" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  if (!Array.isArray(targets) || targets.length === 0) {
    return new Response(
      JSON.stringify({ error: "targets array must not be empty" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  const zipBuffer = await file.arrayBuffer();
  const results = [];
  for (const target of targets) {
    const { accountId, name, type } = target;
    if (!accountId || !name || !type) {
      results.push({ name: name || "unknown", success: false, error: "Missing required fields" });
      continue;
    }
    if (type !== "worker" && type !== "pages") {
      results.push({ name, success: false, error: `Invalid type: ${type}` });
      continue;
    }
    const token = await getCloudflareToken(env, accountId);
    if (!token) {
      results.push({ name, success: false, error: "Account not found or token invalid" });
      continue;
    }
    try {
      const result = type === "pages" ? await deployPages(token, accountId, name, zipBuffer) : await deployWorker(token, accountId, name, zipBuffer);
      results.push({ name, ...result });
    } catch (err) {
      results.push({ name, success: false, error: err.message || "Deploy failed" });
    }
  }
  return new Response(
    JSON.stringify({ results }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}, "onRequestPost");

// api/settings/appearance.ts
var VALID_MODES = ["light", "dark", "system"];
var onRequestGet12 = /* @__PURE__ */ __name(async (context) => {
  const { env } = context;
  const mode = await getConfig(env, "appearance");
  return new Response(
    JSON.stringify({ mode: mode || "system" }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}, "onRequestGet");
var onRequestPut3 = /* @__PURE__ */ __name(async (context) => {
  const { env } = context;
  const body = await context.request.json();
  if (!body.mode || !VALID_MODES.includes(body.mode)) {
    return new Response(
      JSON.stringify({ error: `Invalid mode. Must be one of: ${VALID_MODES.join(", ")}` }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  await setConfig(env, "appearance", body.mode);
  return new Response(
    JSON.stringify({ success: true, mode: body.mode }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}, "onRequestPut");

// api/settings/password.ts
var onRequestPut4 = /* @__PURE__ */ __name(async (context) => {
  const { env } = context;
  const body = await context.request.json();
  if (!body.currentPassword || !body.newPassword) {
    return new Response(
      JSON.stringify({ error: "Current password and new password are required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  if (body.newPassword.length < 8) {
    return new Response(
      JSON.stringify({ error: "New password must be at least 8 characters" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  const passwordHash = await getConfig(env, "password_hash");
  if (!passwordHash) {
    return new Response(
      JSON.stringify({ error: "No password set" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  const valid = await verifyPassword(body.currentPassword, passwordHash);
  if (!valid) {
    return new Response(
      JSON.stringify({ error: "Current password is incorrect" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }
  const newHash = await hashPassword(body.newPassword);
  await setConfig(env, "password_hash", newHash);
  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}, "onRequestPut");

// api/auth/login.ts
var onRequest = /* @__PURE__ */ __name(async (context) => {
  const { env, request } = context;
  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed" }
      }),
      { status: 405, headers: { "Content-Type": "application/json" } }
    );
  }
  const passwordHash = await getConfig(env, "password_hash");
  if (!passwordHash) {
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: "NO_PASSWORD", message: "No password set. Please complete setup first." }
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: "INVALID_BODY", message: "Invalid request body" }
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  if (!body.password) {
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: "MISSING_PASSWORD", message: "Password is required" }
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  const valid = await verifyPassword(body.password, passwordHash);
  if (!valid) {
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: "INVALID_PASSWORD", message: "Invalid password" }
      }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }
  const sessionId = crypto.randomUUID();
  await setSession(env, sessionId, "admin");
  const response = new Response(
    JSON.stringify({ success: true, data: { sessionId } }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
  response.headers.set(
    "Set-Cookie",
    `session=${sessionId}; HttpOnly; Path=/; Max-Age=86400; SameSite=Strict`
  );
  return response;
}, "onRequest");

// api/auth/logout.ts
var onRequest2 = /* @__PURE__ */ __name(async (context) => {
  const { env, request } = context;
  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed" }
      }),
      { status: 405, headers: { "Content-Type": "application/json" } }
    );
  }
  const cookieHeader = request.headers.get("Cookie") || "";
  const sessionId = cookieHeader.split(";").map((c) => c.trim()).find((c) => c.startsWith("session="))?.split("=")[1];
  if (sessionId) {
    await deleteSession(env, sessionId);
  }
  const response = new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
  response.headers.set(
    "Set-Cookie",
    "session=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict"
  );
  return response;
}, "onRequest");

// api/auth/setup.ts
var onRequest3 = /* @__PURE__ */ __name(async (context) => {
  const { env, request } = context;
  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed" }
      }),
      { status: 405, headers: { "Content-Type": "application/json" } }
    );
  }
  const existingPassword = await getConfig(env, "password_hash");
  if (existingPassword) {
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: "ALREADY_SET", message: "Password already set" }
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: "INVALID_BODY", message: "Invalid request body" }
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  if (!body.password || body.password.length < 8) {
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: "WEAK_PASSWORD", message: "Password must be at least 8 characters" }
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  const passwordHash = await hashPassword(body.password);
  const encryptionKey = await generateEncryptionKey();
  await setConfig(env, "password_hash", passwordHash);
  await setConfig(env, "encryption_key", encryptionKey);
  return new Response(
    JSON.stringify({ success: true, data: { message: "Setup complete" } }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}, "onRequest");

// api/auth/status.ts
var onRequest4 = /* @__PURE__ */ __name(async (context) => {
  const { env, request } = context;
  if (request.method !== "GET") {
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed" }
      }),
      { status: 405, headers: { "Content-Type": "application/json" } }
    );
  }
  let passwordHash = await getConfig(env, "password_hash");
  if (!passwordHash) {
    const adminPassword = env.ADMIN_PASSWORD || env.admin_password || context.function?.env?.ADMIN_PASSWORD;
    if (adminPassword) {
      passwordHash = await hashPassword(adminPassword);
      const encryptionKey = await generateEncryptionKey();
      await setConfig(env, "password_hash", passwordHash);
      await setConfig(env, "encryption_key", encryptionKey);
    }
  }
  if (!passwordHash) {
    return new Response(
      JSON.stringify({
        success: true,
        data: { isAuthenticated: false, needsSetup: true }
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
  const cookieHeader = request.headers.get("Cookie") || "";
  const sessionId = cookieHeader.split(";").map((c) => c.trim()).find((c) => c.startsWith("session="))?.split("=")[1];
  if (!sessionId) {
    return new Response(
      JSON.stringify({
        success: true,
        data: { isAuthenticated: false, needsSetup: false }
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
  const accountId = await getSession(env, sessionId);
  if (!accountId) {
    return new Response(
      JSON.stringify({
        success: true,
        data: { isAuthenticated: false, needsSetup: false }
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
  return new Response(
    JSON.stringify({
      success: true,
      data: { isAuthenticated: true, needsSetup: false }
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}, "onRequest");

// api/accounts/[id].ts
var onRequestDelete6 = /* @__PURE__ */ __name(async (context) => {
  const { env, params } = context;
  const id = params.id;
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
}, "onRequestDelete");

// api/accounts/index.ts
var CF_API_BASE3 = "https://api.cloudflare.com/client/v4";
var onRequestGet13 = /* @__PURE__ */ __name(async (context) => {
  const { env } = context;
  const accounts = await getAccounts(env);
  const safeAccounts = accounts.map(({ encryptedToken, iv, ...rest }) => rest);
  return new Response(
    JSON.stringify({ accounts: safeAccounts }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}, "onRequestGet");
var onRequestPost11 = /* @__PURE__ */ __name(async (context) => {
  const { env } = context;
  const body = await context.request.json();
  if (!body.token) {
    return new Response(
      JSON.stringify({ error: "Token is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  const token = body.token.trim();
  let verifyResponse = await fetch(`${CF_API_BASE3}/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    }
  });
  let verifyData = await verifyResponse.json();
  let isApiToken = verifyData.success;
  if (!isApiToken) {
    const accountsResponse2 = await fetch(`${CF_API_BASE3}/accounts`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });
    const accountsData2 = await accountsResponse2.json();
    if (accountsData2.success && accountsData2.result?.length) {
      isApiToken = true;
      verifyData = {
        success: true,
        result: { email: "" }
      };
    }
  }
  if (!isApiToken || !verifyData.success) {
    const errorMessage = verifyData.errors?.[0]?.message || "Invalid token";
    return new Response(
      JSON.stringify({
        error: `Token verification failed: ${errorMessage}`,
        hint: "Please create an API Token at https://dash.cloudflare.com/profile/api-tokens with 'Edit Cloudflare Workers' or 'All Resources' permissions"
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  const accountsResponse = await fetch(`${CF_API_BASE3}/accounts`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    }
  });
  const accountsData = await accountsResponse.json();
  if (!accountsData.success || !accountsData.result?.length) {
    return new Response(
      JSON.stringify({
        error: "No accounts found for this token",
        hint: "Make sure your token has 'Account - Workers' or 'All Resources' permissions"
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  const cfAccount = accountsData.result[0];
  const accountName = body.name || cfAccount.name;
  let encryptionKey = await getConfig(env, "encryption_key");
  if (!encryptionKey) {
    encryptionKey = await generateEncryptionKey();
    await setConfig(env, "encryption_key", encryptionKey);
  }
  const { encrypted, iv } = await encryptData(token, encryptionKey);
  const account = {
    id: cfAccount.id,
    name: accountName,
    type: cfAccount.type,
    email: verifyData.result?.email || "",
    encryptedToken: encrypted,
    iv
  };
  await setAccount(env, account);
  const { encryptedToken, iv: _, ...safeAccount } = account;
  return new Response(
    JSON.stringify({ account: safeAccount }),
    { status: 201, headers: { "Content-Type": "application/json" } }
  );
}, "onRequestPost");

// api/resources/index.ts
var onRequestGet14 = /* @__PURE__ */ __name(async (context) => {
  const { env } = context;
  const accounts = await getAccounts(env);
  const resources = [];
  const fetchPromises = accounts.map(async (account) => {
    const token = await getCloudflareToken(env, account.id);
    if (!token) return;
    const [workersResponse, pagesResponse] = await Promise.all([
      cloudflareFetch(token, `/accounts/${account.id}/workers/workers`),
      cloudflareFetch(token, `/accounts/${account.id}/pages/projects`)
    ]);
    const [workersData, pagesData] = await Promise.all([
      parseCfResponse(workersResponse),
      parseCfResponse(pagesResponse)
    ]);
    if (workersData.success && workersData.result) {
      for (const worker of workersData.result) {
        resources.push({
          name: worker.name,
          type: "worker",
          accountId: account.id,
          accountName: account.name,
          modifiedOn: worker.modified_on
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
          modifiedOn: project.modified_on
        });
      }
    }
  });
  await Promise.all(fetchPromises);
  return new Response(
    JSON.stringify({ resources }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}, "onRequestGet");

// api/test.ts
var onRequest5 = /* @__PURE__ */ __name(async () => {
  return new Response(JSON.stringify({ status: "ok" }), {
    headers: { "Content-Type": "application/json" }
  });
}, "onRequest");

// _middleware.ts
var PUBLIC_AUTH_ROUTES = [
  "/api/auth/setup",
  "/api/auth/login",
  "/api/auth/status"
];
var onRequest6 = /* @__PURE__ */ __name(async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;
  if (!pathname.startsWith("/api/")) {
    return context.next();
  }
  if (PUBLIC_AUTH_ROUTES.includes(pathname)) {
    return context.next();
  }
  const cookieHeader = request.headers.get("Cookie") || "";
  const sessionId = cookieHeader.split(";").map((c) => c.trim()).find((c) => c.startsWith("session="))?.split("=")[1];
  if (!sessionId) {
    return new Response(
      JSON.stringify({ error: "Authentication required" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }
  const accountId = await getSession(env, sessionId);
  if (!accountId) {
    return new Response(
      JSON.stringify({ error: "Invalid or expired session" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }
  return context.next();
}, "onRequest");

// ../.wrangler/tmp/pages-n9Jlts/functionsRoutes-0.18150190860487814.mjs
var routes = [
  {
    routePath: "/api/accounts/:id/kv/:namespace_id/keys/:key",
    mountPath: "/api/accounts/:id/kv/:namespace_id/keys",
    method: "DELETE",
    middlewares: [],
    modules: [onRequestDelete]
  },
  {
    routePath: "/api/accounts/:id/kv/:namespace_id/keys/:key",
    mountPath: "/api/accounts/:id/kv/:namespace_id/keys",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet]
  },
  {
    routePath: "/api/accounts/:id/kv/:namespace_id/keys/:key",
    mountPath: "/api/accounts/:id/kv/:namespace_id/keys",
    method: "PUT",
    middlewares: [],
    modules: [onRequestPut]
  },
  {
    routePath: "/api/accounts/:id/d1/:database_id/query",
    mountPath: "/api/accounts/:id/d1/:database_id",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/api/accounts/:id/d1/:database_id/tables",
    mountPath: "/api/accounts/:id/d1/:database_id",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet2]
  },
  {
    routePath: "/api/accounts/:id/kv/:namespace_id/keys",
    mountPath: "/api/accounts/:id/kv/:namespace_id",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet3]
  },
  {
    routePath: "/api/accounts/:id/pages/:name/deploy",
    mountPath: "/api/accounts/:id/pages/:name",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost2]
  },
  {
    routePath: "/api/accounts/:id/workers/:name/bindings",
    mountPath: "/api/accounts/:id/workers/:name/bindings",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet4]
  },
  {
    routePath: "/api/accounts/:id/workers/:name/bindings",
    mountPath: "/api/accounts/:id/workers/:name/bindings",
    method: "PUT",
    middlewares: [],
    modules: [onRequestPut2]
  },
  {
    routePath: "/api/accounts/:id/workers/:name/deploy",
    mountPath: "/api/accounts/:id/workers/:name",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost3]
  },
  {
    routePath: "/api/accounts/:id/workers/:name/settings",
    mountPath: "/api/accounts/:id/workers/:name",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet5]
  },
  {
    routePath: "/api/accounts/:id/d1/:database_id",
    mountPath: "/api/accounts/:id/d1/:database_id",
    method: "DELETE",
    middlewares: [],
    modules: [onRequestDelete2]
  },
  {
    routePath: "/api/accounts/:id/kv/:namespace_id",
    mountPath: "/api/accounts/:id/kv/:namespace_id",
    method: "DELETE",
    middlewares: [],
    modules: [onRequestDelete3]
  },
  {
    routePath: "/api/accounts/:id/pages/:name",
    mountPath: "/api/accounts/:id/pages",
    method: "DELETE",
    middlewares: [],
    modules: [onRequestDelete4]
  },
  {
    routePath: "/api/accounts/:id/pages/:name",
    mountPath: "/api/accounts/:id/pages/:name",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet6]
  },
  {
    routePath: "/api/accounts/:id/workers/:name",
    mountPath: "/api/accounts/:id/workers",
    method: "DELETE",
    middlewares: [],
    modules: [onRequestDelete5]
  },
  {
    routePath: "/api/accounts/:id/workers/:name",
    mountPath: "/api/accounts/:id/workers/:name",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet7]
  },
  {
    routePath: "/api/accounts/:id/d1",
    mountPath: "/api/accounts/:id/d1",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet8]
  },
  {
    routePath: "/api/accounts/:id/d1",
    mountPath: "/api/accounts/:id/d1",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost4]
  },
  {
    routePath: "/api/accounts/:id/kv",
    mountPath: "/api/accounts/:id/kv",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet9]
  },
  {
    routePath: "/api/accounts/:id/kv",
    mountPath: "/api/accounts/:id/kv",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost5]
  },
  {
    routePath: "/api/accounts/:id/pages",
    mountPath: "/api/accounts/:id/pages",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet10]
  },
  {
    routePath: "/api/accounts/:id/pages",
    mountPath: "/api/accounts/:id/pages",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost6]
  },
  {
    routePath: "/api/accounts/:id/verify",
    mountPath: "/api/accounts/:id",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost7]
  },
  {
    routePath: "/api/accounts/:id/workers",
    mountPath: "/api/accounts/:id/workers",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet11]
  },
  {
    routePath: "/api/accounts/:id/workers",
    mountPath: "/api/accounts/:id/workers",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost8]
  },
  {
    routePath: "/api/batch/delete",
    mountPath: "/api/batch",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost9]
  },
  {
    routePath: "/api/batch/deploy",
    mountPath: "/api/batch",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost10]
  },
  {
    routePath: "/api/settings/appearance",
    mountPath: "/api/settings",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet12]
  },
  {
    routePath: "/api/settings/appearance",
    mountPath: "/api/settings",
    method: "PUT",
    middlewares: [],
    modules: [onRequestPut3]
  },
  {
    routePath: "/api/settings/password",
    mountPath: "/api/settings",
    method: "PUT",
    middlewares: [],
    modules: [onRequestPut4]
  },
  {
    routePath: "/api/auth/login",
    mountPath: "/api/auth",
    method: "",
    middlewares: [],
    modules: [onRequest]
  },
  {
    routePath: "/api/auth/logout",
    mountPath: "/api/auth",
    method: "",
    middlewares: [],
    modules: [onRequest2]
  },
  {
    routePath: "/api/auth/setup",
    mountPath: "/api/auth",
    method: "",
    middlewares: [],
    modules: [onRequest3]
  },
  {
    routePath: "/api/auth/status",
    mountPath: "/api/auth",
    method: "",
    middlewares: [],
    modules: [onRequest4]
  },
  {
    routePath: "/api/accounts/:id",
    mountPath: "/api/accounts",
    method: "DELETE",
    middlewares: [],
    modules: [onRequestDelete6]
  },
  {
    routePath: "/api/accounts",
    mountPath: "/api/accounts",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet13]
  },
  {
    routePath: "/api/accounts",
    mountPath: "/api/accounts",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost11]
  },
  {
    routePath: "/api/resources",
    mountPath: "/api/resources",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet14]
  },
  {
    routePath: "/api/test",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest5]
  },
  {
    routePath: "/",
    mountPath: "/",
    method: "",
    middlewares: [onRequest6],
    modules: []
  }
];

// ../node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// ../node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
export {
  pages_template_worker_default as default
};
