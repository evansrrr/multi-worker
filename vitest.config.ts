import { join } from "node:path";
import { defineConfig } from "vitest/config";

// vitest 的 SSR 模块缓存固定写在 os.tmpdir() 下（见 vitest/dist 中
// `tmpDir = join(tmpdir(), project.id)`）。某些环境（如带 fs 代理层的
// IDE 沙箱）对系统 Temp 目录偶发 EPERM，写入失败会中断单个测试文件的
// 收集——表现为"用例数随机变少"的假绿。
// 配置文件在主进程最先执行，在此把 TMP/TEMP 指向项目内目录，
// 由主进程 spawn 的 worker 会继承该环境变量。
process.env.TMP = process.env.TEMP = process.env.TMPDIR = join(
  process.cwd(),
  "node_modules",
  ".tmp"
);

// Tests target the pure/deterministic helpers in functions/lib/. They run in
// plain Node (Node 18+ ships WebCrypto, Response and Headers globally), so no
// miniflare / workers runtime is required.
export default defineConfig({
  // 缓存目录同样固定到项目内，避免任何写回系统 Temp 的路径。
  cacheDir: "node_modules/.vitest",
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // PBKDF2 hashing with the production iteration count is intentionally
    // slow; individual slow cases declare their own timeout.
    testTimeout: 20000,
  },
});
