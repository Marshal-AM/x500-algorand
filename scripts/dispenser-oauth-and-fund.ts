/**
 * Run algokit dispenser OAuth, open browser, wait for token, fund accounts, write .env.
 */
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const venvAlgokit = join(root, ".venv-algokit", "Scripts", "algokit.exe");
const tokenPath = join(root, ".algokit_ci_token.txt");
const envPath = join(root, ".env");

async function waitForToken(maxMs = 300000): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    if (existsSync(tokenPath)) {
      const t = readFileSync(tokenPath, "utf8").trim();
      if (t.length > 10) return t;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("timeout waiting for .algokit_ci_token.txt — complete browser login");
}

function appendTokenToEnv(token: string): void {
  if (!existsSync(envPath)) return;
  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  const out: string[] = [];
  let set = false;
  for (const line of lines) {
    if (line.startsWith("ALGOKIT_DISPENSER_ACCESS_TOKEN=")) {
      out.push(`ALGOKIT_DISPENSER_ACCESS_TOKEN=${token}`);
      set = true;
    } else {
      out.push(line);
    }
  }
  if (!set) out.push(`ALGOKIT_DISPENSER_ACCESS_TOKEN=${token}`);
  writeFileSync(envPath, `${out.join("\n").trim()}\n`, "utf8");
}

async function main(): Promise<void> {
  if (!existsSync(venvAlgokit)) {
    console.error("[dispenser-oauth] run: python -m venv .venv-algokit && pip install algokit");
    process.exit(1);
  }

  if (existsSync(tokenPath)) {
    console.log("[dispenser-oauth] token file exists, skipping login");
    return;
  }

  console.log("[dispenser-oauth] starting device login — approve in browser if prompted");

  const child = spawn(venvAlgokit, [
    "dispenser",
    "login",
    "--ci",
    "-o",
    "file",
    "-f",
    tokenPath,
  ], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });

  let activateUrl = "";
  child.stdout?.on("data", (buf: Buffer) => {
    const text = buf.toString();
    process.stdout.write(text);
    const m = text.match(/Navigate to: (https:\/\/[^\s]+)/);
    if (m) activateUrl = m[1];
    if (activateUrl) {
      spawn("cmd", ["/c", "start", "", activateUrl], { shell: true, detached: true });
    }
  });
  child.stderr?.on("data", (buf: Buffer) => process.stderr.write(buf));

  const token = await waitForToken();
  appendTokenToEnv(token);
  console.log("[dispenser-oauth] token saved to .env and .algokit_ci_token.txt");
}

main().catch((err) => {
  console.error("[dispenser-oauth] failed", err);
  process.exit(1);
});
