import { describe, expect, it } from "vitest";

import {
  decryptData,
  encryptData,
  ensureEncryptionKey,
  generateEncryptionKey,
  hashPassword,
  passwordNeedsUpgrade,
  resolveEncryptionKey,
  verifyPassword,
  type EncryptionKeyEnv,
} from "../../functions/lib/crypto";

const enc = new TextEncoder();

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}

/** Independent PBKDF2 implementation used to build fixtures. */
async function pbkdf2HashB64(
  password: string,
  saltB64: string,
  iterations: number
): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: fromBase64(saltB64),
      iterations,
    },
    keyMaterial,
    256
  );
  return toBase64(new Uint8Array(bits));
}

async function sha256Hex(password: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(password));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Minimal in-memory KVNamespace stand-in for the encryption key helpers. */
function fakeKv(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    store,
    async get(key: string) {
      return store.has(key) ? (store.get(key) as string) : null;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
    async delete(key: string) {
      store.delete(key);
    },
  };
}

function fakeEnv(overrides: Partial<EncryptionKeyEnv> = {}): EncryptionKeyEnv {
  return {
    TOOL_DATA: fakeKv() as unknown as KVNamespace,
    ...overrides,
  } as EncryptionKeyEnv;
}

describe("hashPassword", () => {
  it("produces the pbkdf2$iterations$salt$hash format", async () => {
    const stored = await hashPassword("correct horse battery staple");
    const parts = stored.split("$");
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe("pbkdf2");
    expect(Number(parts[1])).toBe(210000);
    expect(fromBase64(parts[2])).toHaveLength(16); // 16-byte salt
    expect(fromBase64(parts[3])).toHaveLength(32); // 256-bit hash
  }, 30000);

  it("uses a fresh random salt per call", async () => {
    const a = await hashPassword("same-password");
    const b = await hashPassword("same-password");
    expect(a.split("$")[2]).not.toBe(b.split("$")[2]);
    expect(a).not.toBe(b);
  }, 60000);

  it("hashes empty passwords without throwing", async () => {
    await expect(hashPassword("")).resolves.toMatch(/^pbkdf2\$/);
  }, 30000);

  it("handles non-ASCII passwords", async () => {
    const stored = await hashPassword("密码-with-emoji-🙂");
    await expect(verifyPassword("密码-with-emoji-🙂", stored)).resolves.toBe(
      true
    );
    await expect(verifyPassword("密码-with-emoji-😀", stored)).resolves.toBe(
      false
    );
  }, 60000);
});

describe("verifyPassword", () => {
  const salt = toBase64(new Uint8Array(16).fill(7));
  const iterations = 1000;

  it("accepts the correct password for a pbkdf2 hash", async () => {
    const hash = await pbkdf2HashB64("hunter2", salt, iterations);
    await expect(
      verifyPassword("hunter2", `pbkdf2$${iterations}$${salt}$${hash}`)
    ).resolves.toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await pbkdf2HashB64("hunter2", salt, iterations);
    await expect(
      verifyPassword("hunter3", `pbkdf2$${iterations}$${salt}$${hash}`)
    ).resolves.toBe(false);
  });

  it("rejects a hash produced with a different iteration count", async () => {
    const hash = await pbkdf2HashB64("hunter2", salt, iterations);
    await expect(
      verifyPassword("hunter2", `pbkdf2$${iterations + 1}$${salt}$${hash}`)
    ).resolves.toBe(false);
  });

  it("rejects a hash produced with a different salt", async () => {
    const hash = await pbkdf2HashB64("hunter2", salt, iterations);
    const otherSalt = toBase64(new Uint8Array(16).fill(9));
    await expect(
      verifyPassword("hunter2", `pbkdf2$${iterations}$${otherSalt}$${hash}`)
    ).resolves.toBe(false);
  });

  it("verifies hashes created by hashPassword (full round trip)", async () => {
    const stored = await hashPassword("round-trip-secret");
    await expect(verifyPassword("round-trip-secret", stored)).resolves.toBe(
      true
    );
    await expect(verifyPassword("round-trip-wrong", stored)).resolves.toBe(
      false
    );
  }, 60000);

  it("accepts the legacy unsalted SHA-256 hex format", async () => {
    const legacy = await sha256Hex("legacy-password");
    await expect(verifyPassword("legacy-password", legacy)).resolves.toBe(true);
    await expect(verifyPassword("other-password", legacy)).resolves.toBe(false);
  });

  it("accepts legacy hashes regardless of hex case", async () => {
    const legacy = (await sha256Hex("legacy-password")).toUpperCase();
    await expect(verifyPassword("legacy-password", legacy)).resolves.toBe(true);
  });

  it("returns false for malformed pbkdf2 strings", async () => {
    await expect(verifyPassword("pw", "pbkdf2$1000$salt")).resolves.toBe(false);
    await expect(
      verifyPassword("pw", `pbkdf2$notanumber$${salt}$$`)
    ).resolves.toBe(false);
    await expect(
      verifyPassword("pw", `pbkdf2$0$${salt}$${await pbkdf2HashB64("pw", salt, 1)}`)
    ).resolves.toBe(false);
    await expect(
      verifyPassword("pw", `pbkdf2$-5$${salt}$${await pbkdf2HashB64("pw", salt, 1)}`)
    ).resolves.toBe(false);
  });

  it("returns false when the salt or hash is not valid base64", async () => {
    await expect(verifyPassword("pw", "pbkdf2$1000$!!!$???")).resolves.toBe(
      false
    );
  });

  it("returns false when the stored hash has the wrong length", async () => {
    const shortHash = toBase64(new Uint8Array(8));
    await expect(
      verifyPassword("pw", `pbkdf2$1000$${salt}$${shortHash}`)
    ).resolves.toBe(false);
  });

  it("returns false for unknown formats and empty values", async () => {
    await expect(verifyPassword("pw", "")).resolves.toBe(false);
    await expect(verifyPassword("pw", "not-a-hash")).resolves.toBe(false);
    await expect(verifyPassword("pw", "bcrypt$2a$whatever")).resolves.toBe(
      false
    );
  });
});

describe("passwordNeedsUpgrade", () => {
  it("reports legacy SHA-256 hashes as upgradable", () => {
    expect(
      passwordNeedsUpgrade("a".repeat(64))
    ).toBe(true);
  });

  it("reports pbkdf2 hashes as current", () => {
    expect(passwordNeedsUpgrade("pbkdf2$210000$salt$hash")).toBe(false);
  });

  it("is consistent with verifyPassword for freshly hashed passwords", async () => {
    const stored = await hashPassword("upgrade-check");
    expect(passwordNeedsUpgrade(stored)).toBe(false);
    expect(await verifyPassword("upgrade-check", stored)).toBe(true);
  }, 30000);
});

describe("generateEncryptionKey", () => {
  it("returns base64 of a 256-bit key", async () => {
    const key = await generateEncryptionKey();
    expect(fromBase64(key)).toHaveLength(32);
  });

  it("returns a different key on each call", async () => {
    expect(await generateEncryptionKey()).not.toBe(
      await generateEncryptionKey()
    );
  });
});

describe("encryptData / decryptData", () => {
  it("round-trips a plaintext token", async () => {
    const key = await generateEncryptionKey();
    const { encrypted, iv } = await encryptData("cf-api-token", key);
    expect(iv).toBeTruthy();
    expect(encrypted).not.toBe("cf-api-token");
    await expect(decryptData(encrypted, iv, key)).resolves.toBe("cf-api-token");
  });

  it("uses a fresh 12-byte IV per encryption", async () => {
    const key = await generateEncryptionKey();
    const a = await encryptData("same", key);
    const b = await encryptData("same", key);
    expect(fromBase64(a.iv)).toHaveLength(12);
    expect(a.iv).not.toBe(b.iv);
    expect(a.encrypted).not.toBe(b.encrypted);
  });

  it("round-trips unicode and empty payloads", async () => {
    const key = await generateEncryptionKey();
    for (const value of ["", "中文内容 🙂", "a".repeat(5000)]) {
      const { encrypted, iv } = await encryptData(value, key);
      await expect(decryptData(encrypted, iv, key)).resolves.toBe(value);
    }
  });

  it("fails when decrypting with the wrong key (GCM auth tag)", async () => {
    const key = await generateEncryptionKey();
    const otherKey = await generateEncryptionKey();
    const { encrypted, iv } = await encryptData("secret", key);
    await expect(decryptData(encrypted, iv, otherKey)).rejects.toThrow();
  });

  it("fails when the ciphertext or IV has been tampered with", async () => {
    const key = await generateEncryptionKey();
    const { encrypted, iv } = await encryptData("secret-token", key);
    const bytes = fromBase64(encrypted);
    bytes[0] ^= 0xff;
    await expect(
      decryptData(toBase64(bytes), iv, key)
    ).rejects.toThrow();
    const badIv = toBase64(new Uint8Array(12));
    await expect(decryptData(encrypted, badIv, key)).rejects.toThrow();
  });

  it("fails when the key is not valid base64 for AES-256", async () => {
    await expect(encryptData("x", "not-base64!!!")).rejects.toThrow();
  });
});

describe("resolveEncryptionKey", () => {
  const kvKey = "config:encryption_key";

  it("prefers the Worker Secret when the source is unset", async () => {
    const env = fakeEnv({
      TOKEN_ENC_KEY: "secret-key",
      TOOL_DATA: fakeKv({ [kvKey]: "kv-key" }) as unknown as KVNamespace,
    });
    await expect(resolveEncryptionKey(env)).resolves.toBe("secret-key");
  });

  it("falls back to the KV entry when no secret is configured", async () => {
    const env = fakeEnv({
      TOOL_DATA: fakeKv({ [kvKey]: "kv-key" }) as unknown as KVNamespace,
    });
    await expect(resolveEncryptionKey(env)).resolves.toBe("kv-key");
  });

  it("returns null when neither source holds a key", async () => {
    await expect(resolveEncryptionKey(fakeEnv())).resolves.toBeNull();
  });

  it("ignores the KV entry when ENCRYPTION_KEY_SOURCE=env", async () => {
    const env = fakeEnv({
      ENCRYPTION_KEY_SOURCE: "env",
      TOKEN_ENC_KEY: "secret-key",
      TOOL_DATA: fakeKv({ [kvKey]: "kv-key" }) as unknown as KVNamespace,
    });
    await expect(resolveEncryptionKey(env)).resolves.toBe("secret-key");
  });

  it("returns null for ENCRYPTION_KEY_SOURCE=env without a secret", async () => {
    const env = fakeEnv({
      ENCRYPTION_KEY_SOURCE: "env",
      TOOL_DATA: fakeKv({ [kvKey]: "kv-key" }) as unknown as KVNamespace,
    });
    await expect(resolveEncryptionKey(env)).resolves.toBeNull();
  });

  it("ignores the secret when ENCRYPTION_KEY_SOURCE=kv (rollback switch)", async () => {
    const env = fakeEnv({
      ENCRYPTION_KEY_SOURCE: "kv",
      TOKEN_ENC_KEY: "secret-key",
      TOOL_DATA: fakeKv({ [kvKey]: "kv-key" }) as unknown as KVNamespace,
    });
    await expect(resolveEncryptionKey(env)).resolves.toBe("kv-key");
  });

  it("returns null for ENCRYPTION_KEY_SOURCE=kv with an empty KV entry", async () => {
    const env = fakeEnv({ ENCRYPTION_KEY_SOURCE: "kv" });
    await expect(resolveEncryptionKey(env)).resolves.toBeNull();
  });
});

describe("ensureEncryptionKey", () => {
  const kvKey = "config:encryption_key";

  it("creates a KV key when no secret and no KV key exist", async () => {
    const kv = fakeKv();
    const env = fakeEnv({ TOOL_DATA: kv as unknown as KVNamespace });
    await ensureEncryptionKey(env);
    const created = kv.store.get(kvKey);
    expect(created).toBeTruthy();
    expect(fromBase64(created as string)).toHaveLength(32);
  });

  it("does not overwrite an existing KV key", async () => {
    const kv = fakeKv({ [kvKey]: "existing-key" });
    const env = fakeEnv({ TOOL_DATA: kv as unknown as KVNamespace });
    await ensureEncryptionKey(env);
    expect(kv.store.get(kvKey)).toBe("existing-key");
  });

  it("does nothing when a Worker Secret is the active source", async () => {
    const kv = fakeKv();
    const env = fakeEnv({
      TOKEN_ENC_KEY: "secret-key",
      TOOL_DATA: kv as unknown as KVNamespace,
    });
    await ensureEncryptionKey(env);
    expect(kv.store.has(kvKey)).toBe(false);
  });

  it("does nothing for ENCRYPTION_KEY_SOURCE=env even without a secret", async () => {
    const kv = fakeKv();
    const env = fakeEnv({
      ENCRYPTION_KEY_SOURCE: "env",
      TOOL_DATA: kv as unknown as KVNamespace,
    });
    await ensureEncryptionKey(env);
    expect(kv.store.has(kvKey)).toBe(false);
  });

  it("creates the KV key for ENCRYPTION_KEY_SOURCE=kv even when a secret exists", async () => {
    const kv = fakeKv();
    const env = fakeEnv({
      ENCRYPTION_KEY_SOURCE: "kv",
      TOKEN_ENC_KEY: "secret-key",
      TOOL_DATA: kv as unknown as KVNamespace,
    });
    await ensureEncryptionKey(env);
    expect(kv.store.get(kvKey)).toBeTruthy();
  });
});
