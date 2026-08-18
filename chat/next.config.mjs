import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Load repo-root `.env` so `pnpm chat:dev` sees agent keys without copying. */
function loadParentEnv() {
  const path = resolve(dirname(fileURLToPath(import.meta.url)), "../.env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadParentEnv();

const deployments = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../config/deployments.algorand.testnet.json",
);
if (!process.env.X500_DEPLOYMENTS_PATH?.trim() && existsSync(deployments)) {
  process.env.X500_DEPLOYMENTS_PATH = deployments;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["x500-agent-sdk", "algosdk"],
};

export default nextConfig;
