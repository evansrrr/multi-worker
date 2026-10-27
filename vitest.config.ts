import { defineConfig } from "vitest/config";

// Tests target the pure/deterministic helpers in functions/lib/. They run in
// plain Node (Node 18+ ships WebCrypto, Response and Headers globally), so no
// miniflare / workers runtime is required.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // PBKDF2 hashing with the production iteration count is intentionally
    // slow; individual slow cases declare their own timeout.
    testTimeout: 20000,
  },
});
