import { afterEach, describe, expect, it, vi } from "vitest";

import {
  cfGetAccount,
  cfGetUserEmail,
  cfListAccounts,
  cfProbeWorkersRead,
  isValidAccountId,
  json,
  toSafeAccount,
  type Account,
} from "../../functions/lib/accounts";

type FetchMock = ReturnType<typeof vi.fn>;

function stubFetch(impl: (url: string) => Response | Promise<Response>): FetchMock {
  const mock = vi.fn(impl) as unknown as FetchMock;
  vi.stubGlobal("fetch", mock);
  return mock;
}

function cfJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const okEnvelope = (result: unknown) => ({
  success: true,
  result,
  errors: [],
  messages: [],
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isValidAccountId", () => {
  it("accepts 32-char hex Cloudflare account ids", () => {
    expect(isValidAccountId("a".repeat(32))).toBe(true);
    expect(isValidAccountId("0123456789abcdef0123456789ABCDEF")).toBe(true);
  });

  it("accepts ids with underscores and hyphens", () => {
    expect(isValidAccountId("acc-1_2")).toBe(true);
  });

  it("rejects path traversal and encoded separators", () => {
    for (const bad of ["..", "../admin", "%2e%2e", "a/b", "a\\b", "a.b"]) {
      expect(isValidAccountId(bad)).toBe(false);
    }
  });

  it("rejects empty, oversized and non-string values", () => {
    expect(isValidAccountId("")).toBe(false);
    expect(isValidAccountId("a".repeat(65))).toBe(false);
    expect(isValidAccountId(undefined)).toBe(false);
    expect(isValidAccountId(null)).toBe(false);
    expect(isValidAccountId(123)).toBe(false);
    expect(isValidAccountId({})).toBe(false);
  });

  it("rejects whitespace and control characters", () => {
    expect(isValidAccountId("acc 1")).toBe(false);
    expect(isValidAccountId("acc\n1")).toBe(false);
  });
});

describe("json", () => {
  it("serializes with an application/json content type", async () => {
    const response = json({ ok: true });
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("honours a custom status", () => {
    expect(json({ error: "x" }, 400).status).toBe(400);
  });
});

describe("toSafeAccount", () => {
  const account = {
    id: "acc-1",
    name: "Main",
    type: "cloudflare",
    email: "me@example.com",
    encryptedToken: "cipher",
    iv: "iv",
  } as unknown as Account;

  it("projects only public fields", () => {
    expect(toSafeAccount(account)).toEqual({
      id: "acc-1",
      name: "Main",
      type: "cloudflare",
      email: "me@example.com",
    });
  });

  it("never leaks the encrypted token or IV", () => {
    const safe = toSafeAccount(account);
    expect(safe).not.toHaveProperty("encryptedToken");
    expect(safe).not.toHaveProperty("iv");
    expect(JSON.stringify(safe)).not.toContain("cipher");
  });
});

describe("cfListAccounts", () => {
  it("returns every account the token can see", async () => {
    const mock = stubFetch(() =>
      cfJson(okEnvelope([{ id: "a1", name: "A" }, { id: "a2", name: "B" }]))
    );
    const result = await cfListAccounts("tok");
    expect(result.ok).toBe(true);
    expect(result.result).toHaveLength(2);
    expect(mock.mock.calls[0][0]).toBe(
      "https://api.cloudflare.com/client/v4/accounts"
    );
  });

  it("fails when the token sees no account", async () => {
    stubFetch(() => cfJson(okEnvelope([])));
    const result = await cfListAccounts("tok");
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("看不到任何账户");
  });

  it("fails when the payload is not an array", async () => {
    stubFetch(() => cfJson(okEnvelope(null)));
    const result = await cfListAccounts("tok");
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("看不到任何账户");
  });

  it("maps HTTP 401 to an invalid-token message", async () => {
    stubFetch(() =>
      cfJson(
        {
          success: false,
          result: null,
          errors: [{ code: 9109, message: "Unauthorized" }],
          messages: [],
        },
        401
      )
    );
    const result = await cfListAccounts("tok");
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("令牌无效或已过期");
    expect(result.reason).toContain("Unauthorized");
  });

  it("maps HTTP 403 to a permission message", async () => {
    stubFetch(() => cfJson(okEnvelope(null), 403));
    const result = await cfListAccounts("tok");
    expect(result.reason).toContain("权限不足");
  });

  it("maps HTTP 404 to a not-found message", async () => {
    stubFetch(() => cfJson(okEnvelope(null), 404));
    const result = await cfListAccounts("tok");
    expect(result.reason).toContain("资源不存在");
  });

  it("reports unparsable (HTML) responses with the HTTP status", async () => {
    stubFetch(
      () =>
        new Response("<html>502</html>", {
          status: 502,
          headers: { "Content-Type": "text/html" },
        })
    );
    const result = await cfListAccounts("tok");
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("无法解析的响应（HTTP 502）");
  });

  it("reports network failures instead of throwing", async () => {
    stubFetch(() => {
      throw new Error("getaddrinfo ENOTFOUND");
    });
    const result = await cfListAccounts("tok");
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("无法连接 Cloudflare API");
  });
});

describe("cfGetAccount", () => {
  it("returns the account details", async () => {
    const mock = stubFetch(() =>
      cfJson(okEnvelope({ id: "a1", name: "A", type: "cloudflare" }))
    );
    const result = await cfGetAccount("tok", "a1");
    expect(result.ok).toBe(true);
    expect(result.result?.id).toBe("a1");
    expect(mock.mock.calls[0][0]).toBe(
      "https://api.cloudflare.com/client/v4/accounts/a1"
    );
  });

  it("fails when the payload carries no id", async () => {
    stubFetch(() => cfJson(okEnvelope({ name: "no id" })));
    const result = await cfGetAccount("tok", "a1");
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("账户不存在");
  });
});

describe("cfProbeWorkersRead", () => {
  it("probes with a single-item page", async () => {
    const mock = stubFetch(() => cfJson(okEnvelope([])));
    const result = await cfProbeWorkersRead("tok", "a1");
    expect(result.ok).toBe(true);
    expect(mock.mock.calls[0][0]).toBe(
      "https://api.cloudflare.com/client/v4/accounts/a1/workers/scripts?per_page=1"
    );
  });
});

describe("cfGetUserEmail", () => {
  it("returns the email for a User level token", async () => {
    stubFetch(() => cfJson(okEnvelope({ email: "me@example.com" })));
    await expect(cfGetUserEmail("tok")).resolves.toBe("me@example.com");
  });

  it("returns an empty string when the call fails (Account level token)", async () => {
    stubFetch(() => cfJson(okEnvelope(null), 403));
    await expect(cfGetUserEmail("tok")).resolves.toBe("");
  });

  it("returns an empty string when the payload has no email", async () => {
    stubFetch(() => cfJson(okEnvelope({})));
    await expect(cfGetUserEmail("tok")).resolves.toBe("");
  });
});
