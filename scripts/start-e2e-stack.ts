/**
 * Start all platform + example services (Windows-friendly, separate windows not required).
 * Run from repo root: pnpm exec tsx scripts/start-e2e-stack.ts
 */
import { spawn } from "node:child_process";
import { join } from "node:path";

const root = process.cwd();
const isWin = process.platform === "win32";
const pnpm = isWin ? "pnpm.cmd" : "pnpm";

const services: Array<{ name: string; cwd?: string; script: string; env?: Record<string, string> }> = [
  { name: "indexer", script: "indexer:dev" },
  { name: "settler", script: "settler:dev" },
  { name: "proxy", script: "proxy:dev" },
  { name: "example-fast", script: "example:server" },
  {
    name: "example-slow",
    cwd: join(root, "example", "server"),
    script: "dev:slow",
    env: { SERVER_PORT: "8801", EXAMPLE_LOCAL: "1" },
  },
];

for (const s of services) {
  const child = spawn(pnpm, [s.script], {
    cwd: s.cwd ?? root,
    env: { ...process.env, ...s.env },
    detached: true,
    stdio: "ignore",
    shell: isWin,
  });
  child.unref();
  console.log(`[start] ${s.name} pid=${child.pid}`);
}

console.log("[start] waiting 8s for services…");
await new Promise((r) => setTimeout(r, 8000));

const checks = [
  "http://127.0.0.1:8787/health",
  "http://127.0.0.1:8789/health",
  "http://127.0.0.1:8788/health",
  "http://127.0.0.1:8800/health",
  "http://127.0.0.1:8801/health",
];

for (const url of checks) {
  try {
    const res = await fetch(url);
    console.log(`[health] ${url} → ${res.status}`);
  } catch (err) {
    console.log(`[health] ${url} → FAIL ${err instanceof Error ? err.message : err}`);
  }
}
