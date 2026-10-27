/**
 * Cryptographic utilities for password hashing and data encryption.
 */

const enc = new TextEncoder();
const dec = new TextDecoder();

// ---------------------------------------------------------------------------
// Password hashing (PBKDF2-SHA256)
// ---------------------------------------------------------------------------

const PBKDF2_ITERATIONS = 210000;
const PBKDF2_SALT_BYTES = 16;
const PBKDF2_HASH_BITS = 256;

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

async function pbkdf2Sha256(
  password: string,
  salt: Uint8Array,
  iterations: number
): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    keyMaterial,
    PBKDF2_HASH_BITS
  );
  return new Uint8Array(bits);
}

async function sha256Hex(password: string): Promise<string> {
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    enc.encode(password)
  );
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Hash a password with PBKDF2-SHA256 and a per-user random salt.
 * Stored format: `pbkdf2$<iterations>$<saltBase64>$<hashBase64>`.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(PBKDF2_SALT_BYTES));
  const hash = await pbkdf2Sha256(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

/**
 * Verify a password against a stored hash. Supports two formats:
 * - `pbkdf2$<iterations>$<salt>$<hash>` (current format)
 * - 64-char hex (legacy unsalted SHA-256), kept for backward compatibility
 *   with hashes created before the PBKDF2 migration.
 */
export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  if (stored.startsWith("pbkdf2$")) {
    const parts = stored.split("$");
    if (parts.length !== 4) return false;
    const iterations = Number(parts[1]);
    if (!Number.isInteger(iterations) || iterations < 1) return false;
    let salt: Uint8Array;
    let expected: Uint8Array;
    try {
      salt = fromBase64(parts[2]);
      expected = fromBase64(parts[3]);
    } catch {
      return false;
    }
    const actual = await pbkdf2Sha256(password, salt, iterations);
    return constantTimeEqual(actual, expected);
  }

  // Legacy format: unsalted SHA-256 hex digest.
  if (/^[0-9a-f]{64}$/i.test(stored)) {
    const computed = await sha256Hex(password);
    return computed === stored.toLowerCase();
  }

  return false;
}

/**
 * True when the stored hash is still in the legacy format and should be
 * silently upgraded to PBKDF2 after a successful login.
 */
export function passwordNeedsUpgrade(stored: string): boolean {
  return !stored.startsWith("pbkdf2$");
}

// ---------------------------------------------------------------------------
// Data encryption (AES-GCM) and encryption key management
// ---------------------------------------------------------------------------

/** Legacy KV entry holding the AES key (stored next to the ciphertext). */
const KV_ENCRYPTION_KEY = "config:encryption_key";

export interface EncryptionKeyEnv {
  TOOL_DATA: KVNamespace;
  /** Worker Secret: base64-encoded 256-bit AES key. */
  TOKEN_ENC_KEY?: string;
  /** Key source switch: "env" | "kv". Unset means "env when present". */
  ENCRYPTION_KEY_SOURCE?: string;
}

export async function generateEncryptionKey(): Promise<string> {
  const key = (await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  )) as CryptoKey;
  const rawKey = (await crypto.subtle.exportKey(
    "raw",
    key
  )) as ArrayBuffer;
  return btoa(String.fromCharCode(...new Uint8Array(rawKey)));
}

async function importKey(keyBase64: string): Promise<CryptoKey> {
  const rawKey = Uint8Array.from(atob(keyBase64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Resolve the active AES key used to protect Cloudflare API tokens.
 *
 * Source priority:
 * - ENCRYPTION_KEY_SOURCE=env -> always the Worker Secret TOKEN_ENC_KEY
 * - ENCRYPTION_KEY_SOURCE=kv -> always the legacy KV entry (rollback switch)
 * - unset -> TOKEN_ENC_KEY when present, otherwise the legacy KV entry
 */
export async function resolveEncryptionKey(
  env: EncryptionKeyEnv
): Promise<string | null> {
  const source = env.ENCRYPTION_KEY_SOURCE;
  if (source === "kv") {
    return env.TOOL_DATA.get(KV_ENCRYPTION_KEY);
  }
  if (source === "env") {
    return env.TOKEN_ENC_KEY || null;
  }
  return env.TOKEN_ENC_KEY || (await env.TOOL_DATA.get(KV_ENCRYPTION_KEY));
}

/**
 * Ensure an active encryption key exists. When the Worker Secret is the
 * active source no KV key is created (the secret must be configured instead).
 */
export async function ensureEncryptionKey(
  env: EncryptionKeyEnv
): Promise<void> {
  const source = env.ENCRYPTION_KEY_SOURCE;
  const usesSecret =
    source === "env" || (source !== "kv" && !!env.TOKEN_ENC_KEY);
  if (usesSecret) return;
  const existing = await env.TOOL_DATA.get(KV_ENCRYPTION_KEY);
  if (!existing) {
    await env.TOOL_DATA.put(KV_ENCRYPTION_KEY, await generateEncryptionKey());
  }
}

export async function encryptData(
  data: string,
  keyBase64: string
): Promise<{ encrypted: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await importKey(keyBase64);
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(data)
  );
  return {
    encrypted: btoa(String.fromCharCode(...new Uint8Array(encryptedBuffer))),
    iv: btoa(String.fromCharCode(...iv)),
  };
}

export async function decryptData(
  encryptedBase64: string,
  ivBase64: string,
  keyBase64: string
): Promise<string> {
  const encrypted = Uint8Array.from(atob(encryptedBase64), (c) =>
    c.charCodeAt(0)
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
