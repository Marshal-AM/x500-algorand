/**
 * Publish unscoped Algorand packages via npm CLI (order matters).
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const envPath = join(root, ".env");

function loadNpmToken() {
  if (process.env.NPM_TOKEN?.trim()) return process.env.NPM_TOKEN.trim();
  if (!existsSync(envPath)) return undefined;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    if (line.startsWith("NPM_TOKEN=")) return line.slice("NPM_TOKEN=".length).trim();
  }
  return undefined;
}

const token = loadNpmToken();
if (!token) {
  console.error("[publish] NPM_TOKEN missing in .env");
  process.exit(1);
}

const packages = [
  "packages/protocol-algorand-v1-client",
  "packages/x500-sdk-algorand",
  "packages/x500-algorand",
];

const depPatches = [
  {
    path: join(root, "packages/x500-sdk-algorand/package.json"),
    key: "x500-protocol-algorand-v1-client",
    value: "^0.1.1",
  },
  {
    path: join(root, "packages/x500-algorand/package.json"),
    key: "x500-agent-sdk",
    value: "^0.1.0",
  },
];

const originals = depPatches.map(({ path, key }) => {
  const raw = readFileSync(path, "utf8");
  const pkg = JSON.parse(raw);
  const original = pkg.dependencies?.[key];
  return { path, key, original, raw };
});

for (const { path, key, value } of depPatches) {
  const pkg = JSON.parse(readFileSync(path, "utf8"));
  if (pkg.dependencies?.[key]) pkg.dependencies[key] = value;
  writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`);
}

try {
  for (const rel of packages) {
    const dir = join(root, rel);
    const npmrcPath = join(dir, ".npmrc");
    const hadNpmrc = existsSync(npmrcPath);
    const prevNpmrc = hadNpmrc ? readFileSync(npmrcPath, "utf8") : null;

    writeFileSync(npmrcPath, `//registry.npmjs.org/:_authToken=${token}\n`, "utf8");

    console.log(`[publish] building ${rel}`);
    execSync("npm run build", { cwd: dir, stdio: "inherit" });
    console.log(`[publish] npm publish ${rel}`);
    try {
      execSync("npm publish --access public", {
        cwd: dir,
        encoding: "utf8",
        stdio: ["inherit", "inherit", "pipe"],
      });
    } catch (err) {
      const stderr =
        err && typeof err === "object" && "stderr" in err
          ? String(err.stderr ?? "")
          : "";
      const msg = err instanceof Error ? err.message : String(err);
      if (
        stderr.includes("previously published versions") ||
        msg.includes("previously published versions")
      ) {
        console.warn(`[publish] skip ${rel} — version already on npm`);
      } else {
        if (stderr) process.stderr.write(stderr);
        throw err;
      }
    }

    if (hadNpmrc) writeFileSync(npmrcPath, prevNpmrc, "utf8");
    else unlinkSync(npmrcPath);
  }
  console.log("[publish] all packages published");
} finally {
  for (const { path, key, original, raw } of originals) {
    if (original !== undefined) {
      const pkg = JSON.parse(readFileSync(path, "utf8"));
      pkg.dependencies[key] = original;
      writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`);
    } else {
      writeFileSync(path, raw);
    }
  }
}
