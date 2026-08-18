/**
 * Compile Algorand TypeScript contracts to TEAL + ARC32 artifacts.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const contractsDir = join(root, "contracts");
const outDir = join(root, "artifacts");

const puyaBin = join(
  root,
  "node_modules",
  "@algorandfoundation",
  "puya-ts",
  "bin",
  "run-cli.mjs",
);

if (!existsSync(puyaBin)) {
  console.error(
    "[protocol-algorand-v1] missing @algorandfoundation/puya-ts — run pnpm install",
  );
  process.exit(1);
}

console.log("[protocol-algorand-v1] compiling contracts…");
execFileSync(
  process.execPath,
  [puyaBin, "build", contractsDir, "--out-dir", outDir],
  { cwd: root, stdio: "inherit" },
);
console.log("[protocol-algorand-v1] artifacts →", outDir);
