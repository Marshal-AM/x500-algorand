import { existsSync } from "node:fs";
import { isAbsolute, join } from "node:path";

const DEFAULT_FILE = "deployments.algorand.testnet.json";

function monorepoRoots(cwd: string): string[] {
  return [
    cwd,
    join(cwd, ".."),
    join(cwd, "../.."),
    join(cwd, "../../.."),
    join(cwd, "../../../.."),
  ];
}

function resolveRelative(path: string, cwd: string): string | null {
  if (isAbsolute(path)) {
    return existsSync(path) ? path : null;
  }
  for (const root of monorepoRoots(cwd)) {
    const full = join(root, path);
    if (existsSync(full)) return full;
  }
  return null;
}

/** Resolve deployments JSON across monorepo cwd (root vs packages/*). */
export function resolveDeploymentsPath(explicit?: string): string {
  const cwd = process.cwd();
  const candidates: string[] = [];

  const push = (p?: string) => {
    const t = p?.trim();
    if (!t) return;
    const resolved = resolveRelative(t, cwd);
    if (resolved) candidates.push(resolved);
  };

  push(explicit);
  push(process.env.X500_DEPLOYMENTS_PATH);

  for (const root of monorepoRoots(cwd)) {
    const p = join(root, "config", DEFAULT_FILE);
    if (existsSync(p)) candidates.push(p);
  }

  if (candidates.length > 0) return candidates[0]!;

  const fallback = join(cwd, "config", DEFAULT_FILE);
  return fallback;
}
