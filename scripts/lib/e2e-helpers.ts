import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { join } from "node:path";

export function deploymentsPath(): string {
  return (
    process.env.X500_DEPLOYMENTS_PATH?.trim() ||
    join(process.cwd(), "config", "deployments.algorand.testnet.json")
  );
}

export async function waitHttpOk(
  url: string,
  timeoutMs = 60_000,
  predicate?: (body: unknown) => boolean,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const body = await res.json().catch(() => ({}));
        if (!predicate || predicate(body)) return;
      }
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`health timeout: ${url}`);
}

export function spawnPkg(
  filter: string,
  entry: string,
  env: NodeJS.ProcessEnv,
): ChildProcess {
  return spawn("pnpm", ["--filter", filter, "exec", "tsx", entry], {
    stdio: "inherit",
    shell: true,
    cwd: process.cwd(),
    env: {
      ...process.env,
      X500_DEPLOYMENTS_PATH: deploymentsPath(),
      ...env,
    },
  });
}

export async function killChild(child: ChildProcess | null): Promise<void> {
  if (!child?.pid) return;
  const { spawnSync } = await import("node:child_process");
  // Windows: kill process tree; POSIX: SIGTERM then SIGKILL
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      shell: true,
    });
  } else {
    child.kill("SIGTERM");
    await new Promise((r) => setTimeout(r, 400));
    if (!child.killed) child.kill("SIGKILL");
  }
  await new Promise((r) => setTimeout(r, 300));
}

export function runTsx(script: string): void {
  const r = spawnSync("pnpm", ["exec", "tsx", "--env-file=.env", script], {
    stdio: "inherit",
    shell: true,
    cwd: process.cwd(),
    env: process.env,
  });
  if (r.status !== 0) throw new Error(`${script} failed`);
}
