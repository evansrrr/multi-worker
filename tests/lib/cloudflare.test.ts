import { afterEach, describe, expect, it, vi } from "vitest";

import {
  cloudflareFetch,
  getCloudflareToken,
  parseCfResponse,
} from "../../functions/lib/cloudflare";
import { encryptData } from "../../functions/lib/crypto";

const CF_API_BASE = "https://api.cloudflare.com/client/v4";

type FetchMock = ReturnType<typeof vi.fn>;

function stubFetch(): FetchMock {
  const mock = vi.fn(
    async () => new Response(null, { status: 200 })
  ) as unknown as FetchMock;
  vi.stubGlobal("fetch", mock);
  return mock;
}

function headersOf(mock: FetchMock): Headers {
  const init = mock.mock.calls[0][1] as RequestInit;
  return new Headers(init.headers);
}

/** Minimal in-memory KVNamespace stand-in. */
function fakeKv(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    store,
    async get(key: string, type?: string) {
      const raw = store.get(key);
      if (raw === undefined) return null;
      return type === "json" ? (JSON.parse(raw) as unknown) : raw;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
    async delete(key: string) {
      store.delete(key);
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseCfResponse", () => {
  it("returns the parsed JSON body", async () => {
    const payload = {
      success: true,
      result: { id: "abc" },
      errors: [],
      messages: [],
    };
    const response = new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
    await expect(parseCfResponse(response)).resolves.toEqual(payload);
  });

  it("accepts a JSON content type with a charset parameter", async () => {
    const response = new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
    await expect(parseCfResponse(response)).resolves.toMatchObject({
      success: true,
    });
  });

  it("passes through API-level errors that arrive as JSON", async () => {
    const payload = {
      success: false,
      result: null,
      errors: [{ code: 10000, message: "Authentication error" }],
      messages: [],
    };
    const response = new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
    const parsed = await parseCfResponse<null>(response);
    expect(parsed.success).toBe(false);
    expect(parsed.errors[0].code).toBe(10000);
  });

  it("throws on an HTML error page (Cloudflare edge / 502 gateway)", async () => {
    const html = "<html><head><title>502 Bad Gateway</title></head></html>";
    const build = () =>
      new Response(html, {
        status: 502,
        headers: { "Content-Type": "text/html" },
      });
    await expect(parseCfResponse(build())).rejects.toThrow(
      /non-JSON response \(status 502\)/
    );
    // The response body can only be consumed once, hence a fresh Response.
    await expect(parseCfResponse(build())).rejects.toThrow(/Bad Gateway/);
  });

  it("truncates long non-JSON bodies to 200 characters", async () => {
    const longText = "x".repeat(5000);
    const response = new Response(longText, {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });
    const error = await parseCfResponse(response).catch((e: Error) => e);
    const prefix = "Cloudflare API returned non-JSON response (status 500): ";
    expect(error.message.startsWith(prefix)).toBe(true);
    expect(error.message.length).toBe(prefix.length + 200);
  });

  it("throws on an empty body without a JSON content type", async () => {
    const response = new Response(null, { status: 500 });
    await expect(parseCfResponse(response)).rejects.toThrow(
      /non-JSON response \(status 500\)/
    );
  });

  it("rejects when the content type claims JSON but the body is empty", async () => {
    const response = new Response("", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
    await expect(parseCfResponse(response)).rejects.toThrow();
  });
});

describe("cloudflareFetch", () => {
  it("prefixes the Cloudflare v4 API base URL", async () => {
    const mock = stubFetch();
    await cloudflareFetch("tok", "/zones");
    expect(mock.mock.calls[0][0]).toBe(`${CF_API_BASE}/zones`);
  });

  it("sets the Authorization bearer header", async () => {
    const mock = stubFetch();
    await cloudflareFetch("secret-token", "/accounts");
    expect(headersOf(mock).get("Authorization")).toBe("Bearer secret-token");
  });

  it("injects application/json for a string body", async () => {
    const mock = stubFetch();
    await cloudflareFetch("tok", "/x", { method: "PUT", body: "{}" });
    expect(headersOf(mock).get("Content-Type")).toBe("application/json");
  });

  it("injects application/json for a plain object body", async () => {
    const mock = stubFetch();
    await cloudflareFetch("tok", "/x", { method: "POST", body: { a: 1 } });
    expect(headersOf(mock).get("Content-Type")).toBe("application/json");
  });

  it("keeps a caller supplied Content-Type instead of overwriting it", async () => {
    const mock = stubFetch();
    await cloudflareFetch("tok", "/x", {
      method: "PUT",
      body: "{}",
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
    expect(headersOf(mock).get("Content-Type")).toBe(
      "application/json; charset=utf-8"
    );
  });

  it("does not inject Content-Type for FormData (multipart boundary)", async () => {
    const mock = stubFetch();
    const form = new FormData();
    form.set("file", new Blob(["x"]), "a.txt");
    await cloudflareFetch("tok", "/x", { method: "POST", body: form });
    expect(headersOf(mock).has("Content-Type")).toBe(false);
  });

  it("does not inject Content-Type for Blob / ArrayBuffer / URLSearchParams bodies", async () => {
    for (const body of [
      new Blob(["x"]),
      new ArrayBuffer(8),
      new URLSearchParams({ a: "1" }),
    ]) {
      const mock = stubFetch();
      await cloudflareFetch("tok", "/x", { method: "POST", body });
      expect(headersOf(mock).has("Content-Type")).toBe(false);
    }
  });

  it("does not inject Content-Type for a ReadableStream body", async () => {
    const mock = stubFetch();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("x"));
        controller.close();
      },
    });
    await cloudflareFetch("tok", "/x", { method: "POST", body: stream });
    expect(headersOf(mock).has("Content-Type")).toBe(false);
  });

  it("does not inject Content-Type for a bodyless request", async () => {
    const mock = stubFetch();
    await cloudflareFetch("tok", "/x");
    expect(headersOf(mock).has("Content-Type")).toBe(false);
  });

  it("forwards method and body untouched", async () => {
    const mock = stubFetch();
    await cloudflareFetch("tok", "/x", { method: "DELETE", body: "{}" });
    const init = mock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("DELETE");
    expect(init.body).toBe("{}");
  });

  // Documents current behaviour: the token always wins, a caller supplied
  // Authorization header cannot override it.
  it("always overwrites a caller supplied Authorization header", async () => {
    const mock = stubFetch();
    await cloudflareFetch("tok", "/x", {
      headers: { Authorization: "Bearer custom" },
    });
    expect(headersOf(mock).get("Authorization")).toBe("Bearer tok");
  });
});

describe("getCloudflareToken", () => {
  async function makeEnv(key: string) {
    const { encrypted, iv } = await encryptData("cf-token-value", key);
    const kv = fakeKv({
      "account:acc-1": JSON.stringify({
        id: "acc-1",
        name: "Main",
        type: "cloudflare",
        email: "me@example.com",
        encryptedToken: encrypted,
        iv,
      }),
    });
    return { env: { TOOL_DATA: kv as unknown as KVNamespace, TOKEN_ENC_KEY: key }, kv };
  }

  it("returns the decrypted token for a known account", async () => {
    const key = "c".repeat(43);
    const { env } = await makeEnv(key);
    await expect(getCloudflareToken(env, "acc-1")).resolves.toBe(
      "cf-token-value"
    );
  });

  it("returns null when the account does not exist", async () => {
    const key = "c".repeat(43);
    const { env } = await makeEnv(key);
    await expect(getCloudflareToken(env, "missing")).resolves.toBeNull();
  });

  it("returns null when the token cannot be decrypted (wrong key)", async () => {
    const { env } = await makeEnv("c".repeat(43));
    const wrongEnv = { ...env, TOKEN_ENC_KEY: "d".repeat(43) };
    await expect(getCloudflareToken(wrongEnv, "acc-1")).resolves.toBeNull();
  });

  it("returns null when no encryption key is available", async () => {
    const { env } = await makeEnv("c".repeat(43));
    await expect(
      getCloudflareToken({ TOOL_DATA: env.TOOL_DATA }, "acc-1")
    ).resolves.toBeNull();
  });
});
