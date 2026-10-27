import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearLoginFailures,
  deleteAccount,
  deleteSession,
  getAccount,
  getAccounts,
  getConfig,
  getLoginFailures,
  getSession,
  getSessionEpoch,
  incrementSessionEpoch,
  isLoginLocked,
  recordLoginFailure,
  setAccount,
  setConfig,
  setSession,
  type Account,
} from "../../functions/lib/kv";

/**
 * In-memory KVNamespace stand-in. Mirrors the real behaviour that these
 * helpers rely on: missing keys read as null, `get(key, "json")` parses and
 * throws on malformed JSON, and `list({ prefix })` returns stored key names.
 */
function fakeKv(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  const ttls = new Map<string, number>();
  return {
    store,
    ttls,
    async get(key: string, type?: string) {
      const raw = store.get(key);
      if (raw === undefined) return null;
      if (type === "json") return JSON.parse(raw) as unknown;
      return raw;
    },
    async put(key: string, value: string, options?: { expirationTtl?: number }) {
      store.set(key, value);
      if (options?.expirationTtl !== undefined) {
        ttls.set(key, options.expirationTtl);
      } else {
        ttls.delete(key);
      }
    },
    async delete(key: string) {
      store.delete(key);
      ttls.delete(key);
    },
    async list(options?: { prefix?: string }) {
      const prefix = options?.prefix ?? "";
      return {
        keys: [...store.keys()]
          .filter((k) => k.startsWith(prefix))
          .map((name) => ({ name })),
      };
    },
  };
}

type Env = { TOOL_DATA: KVNamespace; TOKEN_ENC_KEY?: string };

function envWith(kv: ReturnType<typeof fakeKv>, extra: Partial<Env> = {}): Env {
  return { TOOL_DATA: kv as unknown as KVNamespace, ...extra };
}

const ACCOUNT: Account = {
  id: "acc-1",
  name: "Main account",
  type: "cloudflare",
  email: "me@example.com",
  encryptedToken: "cipher",
  iv: "iv",
};

describe("getConfig / setConfig", () => {
  it("reads a value under the config: prefix", async () => {
    const kv = fakeKv({ "config:theme": "dark" });
    await expect(getConfig(envWith(kv), "theme")).resolves.toBe("dark");
  });

  it("returns null for an unset key", async () => {
    await expect(getConfig(envWith(fakeKv()), "theme")).resolves.toBeNull();
  });

  it("writes a value under the config: prefix", async () => {
    const kv = fakeKv();
    await setConfig(envWith(kv), "theme", "light");
    expect(kv.store.get("config:theme")).toBe("light");
    await expect(getConfig(envWith(kv), "theme")).resolves.toBe("light");
  });

  it("routes encryption_key through the active key source", async () => {
    // A KV entry exists but the Worker Secret must win.
    const kv = fakeKv({ "config:encryption_key": "kv-key" });
    await expect(
      getConfig(envWith(kv, { TOKEN_ENC_KEY: "secret-key" }), "encryption_key")
    ).resolves.toBe("secret-key");
    await expect(
      getConfig(envWith(kv), "encryption_key")
    ).resolves.toBe("kv-key");
  });
});

describe("session epoch", () => {
  it("defaults to 0 when unset", async () => {
    await expect(getSessionEpoch(envWith(fakeKv()))).resolves.toBe(0);
  });

  it("parses a numeric epoch", async () => {
    await expect(
      getSessionEpoch(envWith(fakeKv({ "config:session_epoch": "3" })))
    ).resolves.toBe(3);
  });

  it("falls back to 0 for non numeric or corrupt values", async () => {
    for (const raw of ["abc", "", "NaN", "Infinity"]) {
      await expect(
        getSessionEpoch(envWith(fakeKv({ "config:session_epoch": raw })))
      ).resolves.toBe(0);
    }
  });

  it("increments and persists the epoch", async () => {
    const kv = fakeKv();
    const env = envWith(kv);
    await expect(incrementSessionEpoch(env)).resolves.toBe(1);
    await expect(incrementSessionEpoch(env)).resolves.toBe(2);
    expect(kv.store.get("config:session_epoch")).toBe("2");
  });
});

describe("setSession / getSession", () => {
  it("round-trips a session for the current epoch", async () => {
    const kv = fakeKv({ "config:session_epoch": "2" });
    const env = envWith(kv);
    await setSession(env, "sid-1", "alice", 2);
    expect(JSON.parse(kv.store.get("session:sid-1") as string)).toEqual({
      u: "alice",
      e: 2,
    });
    await expect(getSession(env, "sid-1")).resolves.toBe("alice");
  });

  it("stores a 24h expirationTtl", async () => {
    const kv = fakeKv();
    await setSession(envWith(kv), "sid-1", "alice", 0);
    expect(kv.ttls.get("session:sid-1")).toBe(24 * 60 * 60);
  });

  it("returns null for an unknown session", async () => {
    await expect(getSession(envWith(fakeKv()), "nope")).resolves.toBeNull();
  });

  it("invalidates sessions issued before a password change (epoch bump)", async () => {
    const kv = fakeKv({ "config:session_epoch": "1" });
    const env = envWith(kv);
    await setSession(env, "old", "alice", 1);
    await expect(getSession(env, "old")).resolves.toBe("alice");

    await incrementSessionEpoch(env); // epoch -> 2
    await expect(getSession(env, "old")).resolves.toBeNull();
  });

  it("treats legacy plain-string sessions as valid", async () => {
    const kv = fakeKv({
      "session:legacy": "bob",
      "config:session_epoch": "9",
    });
    await expect(getSession(envWith(kv), "legacy")).resolves.toBe("bob");
  });

  it("returns null for corrupt JSON session records", async () => {
    const kv = fakeKv({ "session:broken": "{not json" });
    await expect(getSession(envWith(kv), "broken")).resolves.toBeNull();
  });

  it("returns null when the record has no user name", async () => {
    const kv = fakeKv({ "session:nou": JSON.stringify({ e: 0 }) });
    await expect(getSession(envWith(kv), "nou")).resolves.toBeNull();
  });

  it("deletes a session", async () => {
    const kv = fakeKv({ "session:sid": JSON.stringify({ u: "a", e: 0 }) });
    const env = envWith(kv);
    await deleteSession(env, "sid");
    expect(kv.store.has("session:sid")).toBe(false);
    await expect(getSession(env, "sid")).resolves.toBeNull();
  });
});

describe("login failure rate limiting", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts at zero failures", async () => {
    await expect(getLoginFailures(envWith(fakeKv()), "1.2.3.4")).resolves.toEqual(
      { count: 0, since: 0 }
    );
  });

  it("counts failures and locks after 5 attempts", async () => {
    const kv = fakeKv();
    const env = envWith(kv);
    for (let i = 1; i <= 5; i++) {
      await recordLoginFailure(env, "1.2.3.4");
      expect(await getLoginFailures(env, "1.2.3.4")).toMatchObject({
        count: i,
      });
    }
    expect(isLoginLocked(await getLoginFailures(env, "1.2.3.4"))).toBe(true);
  });

  it("does not lock below the threshold", async () => {
    const env = envWith(fakeKv());
    await recordLoginFailure(env, "1.2.3.4");
    await recordLoginFailure(env, "1.2.3.4");
    expect(isLoginLocked(await getLoginFailures(env, "1.2.3.4"))).toBe(false);
  });

  it("keeps the original window start while counting", async () => {
    const env = envWith(fakeKv());
    await recordLoginFailure(env, "1.2.3.4");
    const first = await getLoginFailures(env, "1.2.3.4");
    vi.advanceTimersByTime(60_000);
    await recordLoginFailure(env, "1.2.3.4");
    const second = await getLoginFailures(env, "1.2.3.4");
    expect(second.count).toBe(2);
    expect(second.since).toBe(first.since);
  });

  it("expires the window after 15 minutes (lazy GC on read)", async () => {
    const env = envWith(fakeKv());
    await recordLoginFailure(env, "1.2.3.4");
    await recordLoginFailure(env, "1.2.3.4");
    vi.advanceTimersByTime(15 * 60 * 1000);
    await expect(getLoginFailures(env, "1.2.3.4")).resolves.toEqual({
      count: 0,
      since: 0,
    });
  });

  it("restarts the window after expiry", async () => {
    const env = envWith(fakeKv());
    await recordLoginFailure(env, "1.2.3.4");
    vi.advanceTimersByTime(20 * 60 * 1000);
    await recordLoginFailure(env, "1.2.3.4");
    const state = await getLoginFailures(env, "1.2.3.4");
    expect(state.count).toBe(1);
    expect(state.since).toBe(Date.now());
  });

  it("stores the failure record with a 15 minute TTL", async () => {
    const kv = fakeKv();
    await recordLoginFailure(envWith(kv), "1.2.3.4");
    expect(kv.ttls.get("login_fail:1.2.3.4")).toBe(15 * 60);
  });

  it("resets corrupt or malformed state to zero", async () => {
    const kv = fakeKv({
      "login_fail:1.2.3.4": "{not json",
      "login_fail:5.6.7.8": JSON.stringify({ count: "3", since: 0 }),
      "login_fail:9.9.9.9": JSON.stringify({ count: 3 }),
    });
    const env = envWith(kv);
    for (const ip of ["1.2.3.4", "5.6.7.8", "9.9.9.9"]) {
      await expect(getLoginFailures(env, ip)).resolves.toEqual({
        count: 0,
        since: 0,
      });
    }
  });

  it("clears failures after a successful login", async () => {
    const kv = fakeKv();
    const env = envWith(kv);
    await recordLoginFailure(env, "1.2.3.4");
    await clearLoginFailures(env, "1.2.3.4");
    expect(kv.store.has("login_fail:1.2.3.4")).toBe(false);
    await expect(getLoginFailures(env, "1.2.3.4")).resolves.toEqual({
      count: 0,
      since: 0,
    });
  });

  it("tracks failures per IP independently", async () => {
    const env = envWith(fakeKv());
    await recordLoginFailure(env, "1.1.1.1");
    await recordLoginFailure(env, "1.1.1.1");
    await recordLoginFailure(env, "2.2.2.2");
    expect((await getLoginFailures(env, "1.1.1.1")).count).toBe(2);
    expect((await getLoginFailures(env, "2.2.2.2")).count).toBe(1);
  });
});

describe("isLoginLocked", () => {
  it("locks at the 5 attempt threshold", () => {
    expect(isLoginLocked({ count: 4, since: 0 })).toBe(false);
    expect(isLoginLocked({ count: 5, since: 0 })).toBe(true);
    expect(isLoginLocked({ count: 9, since: 0 })).toBe(true);
  });
});

describe("account storage", () => {
  it("lists accounts stored under the account: prefix", async () => {
    const kv = fakeKv({
      "account:acc-1": JSON.stringify(ACCOUNT),
      "account:acc-2": JSON.stringify({ ...ACCOUNT, id: "acc-2", name: "B" }),
      "config:theme": "dark",
    });
    const accounts = await getAccounts(envWith(kv));
    expect(accounts).toHaveLength(2);
    expect(accounts.map((a) => a.id).sort()).toEqual(["acc-1", "acc-2"]);
  });

  it("ignores entries under other prefixes", async () => {
    const kv = fakeKv({ "session:sid": "alice" });
    await expect(getAccounts(envWith(kv))).resolves.toEqual([]);
  });

  it("reads a single account as JSON", async () => {
    const kv = fakeKv({ "account:acc-1": JSON.stringify(ACCOUNT) });
    await expect(getAccount(envWith(kv), "acc-1")).resolves.toEqual(ACCOUNT);
  });

  it("returns null for a missing account", async () => {
    await expect(getAccount(envWith(fakeKv()), "nope")).resolves.toBeNull();
  });

  it("writes an account under account:<id>", async () => {
    const kv = fakeKv();
    await setAccount(envWith(kv), ACCOUNT);
    expect(kv.store.get("account:acc-1")).toBe(JSON.stringify(ACCOUNT));
    await expect(getAccount(envWith(kv), "acc-1")).resolves.toEqual(ACCOUNT);
  });

  it("deletes an account", async () => {
    const kv = fakeKv({ "account:acc-1": JSON.stringify(ACCOUNT) });
    await deleteAccount(envWith(kv), "acc-1");
    expect(kv.store.has("account:acc-1")).toBe(false);
  });
});
