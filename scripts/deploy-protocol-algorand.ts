/**
 * Deploy x500 Algorand protocol apps to testnet from compiled ARC-56 artifacts.
 * Requires ALGORAND_OPERATOR_MNEMONIC in .env
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import algosdk from "algosdk";

const root = process.cwd();
const artifactsDir = join(
  root,
  "packages",
  "protocol-algorand-v1",
  "artifacts",
);

const algodUrl =
  process.env.ALGORAND_ALGOD_URL?.trim() ??
  "https://testnet-api.algonode.cloud";
const mnemonic = process.env.ALGORAND_OPERATOR_MNEMONIC?.trim();

if (!mnemonic) {
  console.error("ALGORAND_OPERATOR_MNEMONIC required");
  process.exit(1);
}

if (!existsSync(artifactsDir)) {
  console.error(
    "Missing contract artifacts — run pnpm protocol:compile first",
  );
  process.exit(1);
}

interface Arc56Bytecode {
  name: string;
  state: {
    schema: {
      global: { ints: number; bytes: number };
      local: { ints: number; bytes: number };
    };
  };
  bytecode: {
    approval: string;
    clear: string;
  };
}

function loadArc56(name: string): Arc56Bytecode {
  const path = join(artifactsDir, `${name}.arc56.json`);
  const raw = JSON.parse(readFileSync(path, "utf8")) as Arc56Bytecode & {
    byteCode?: { approval: string; clear: string };
  };
  const bytecode = raw.bytecode ?? raw.byteCode;
  if (!bytecode?.approval || !bytecode?.clear) {
    throw new Error(`missing bytecode in ${path}`);
  }
  return { ...raw, bytecode };
}

const account = algosdk.mnemonicToSecretKey(mnemonic);
const algod = new algosdk.Algodv2("", algodUrl, "");
const indexerUrl =
  process.env.ALGORAND_INDEXER_URL?.trim() ??
  "https://testnet-idx.algonode.cloud";
const indexer = new algosdk.Indexer("", indexerUrl, "");

function appAddress(appId: number): string {
  return algosdk.getApplicationAddress(appId).toString();
}

async function resolveCreatedAppId(txid: string): Promise<number> {
  const pending = await algod.pendingTransactionInformation(txid).do();
  const fromPending = Number(pending.applicationIndex ?? 0);
  if (fromPending > 0) return fromPending;

  const { transaction } = await indexer.lookupTransactionByID(txid).do();
  const fromIndexer = Number(transaction?.createdApplicationIndex ?? 0);
  if (fromIndexer > 0) return fromIndexer;

  throw new Error(`could not resolve application id for tx ${txid}`);
}

async function deployApp(name: string): Promise<{ appId: number; address: string }> {
  const arc56 = loadArc56(name);
  const approvalProgram = Uint8Array.from(
    Buffer.from(arc56.bytecode.approval, "base64"),
  );
  const clearProgram = Uint8Array.from(
    Buffer.from(arc56.bytecode.clear, "base64"),
  );
  const params = await algod.getTransactionParams().do();
  const txn = algosdk.makeApplicationCreateTxnFromObject({
    sender: account.addr,
    suggestedParams: params,
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
    approvalProgram,
    clearProgram,
    numLocalInts: arc56.state.schema.local.ints,
    numLocalByteSlices: arc56.state.schema.local.bytes,
    numGlobalInts: arc56.state.schema.global.ints,
    numGlobalByteSlices: arc56.state.schema.global.bytes,
    extraPages: 3,
  });
  const signed = txn.signTxn(account.sk);
  const { txid } = await algod.sendRawTransaction(signed).do();
  await algosdk.waitForConfirmation(algod, txid, 10);
  const appId = await resolveCreatedAppId(txid);
  const address = appAddress(appId);
  console.log(`[deploy] ${name} appId=${appId} address=${address} tx=${txid}`);
  return { appId, address };
}

interface DeployedApp {
  appId: number;
  address: string;
}

interface DeploymentsFile {
  network: string;
  deployedAt: string;
  authorityAddress: string;
  registry: DeployedApp;
  pool: DeployedApp;
  settler: DeployedApp;
}

function loadExistingDeployments(path: string): DeploymentsFile | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as DeploymentsFile;
  } catch {
    return null;
  }
}

async function deployOrReuse(
  artifactName: string,
  existing: DeployedApp | undefined,
  forceRedeploy: boolean,
): Promise<DeployedApp> {
  if (!forceRedeploy && existing?.appId && existing.appId > 0) {
    const address = existing.address || appAddress(existing.appId);
    console.log(`[deploy] reuse ${artifactName} appId=${existing.appId}`);
    return { appId: existing.appId, address };
  }
  return deployApp(artifactName);
}

async function main(): Promise<void> {
  const outPath =
    process.env.X500_DEPLOYMENTS_PATH?.trim() ??
    join(root, "config", "deployments.algorand.testnet.json");
  const existing = loadExistingDeployments(outPath);
  const force = new Set(
    (process.env.X500_FORCE_REDEPLOY?.trim() ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );

  const registry = await deployOrReuse(
    "X500Registry",
    existing?.registry,
    force.has("registry"),
  );
  const pool = await deployOrReuse(
    "X500Pool",
    existing?.pool,
    force.has("pool"),
  );
  const settler = await deployOrReuse(
    "X500Settler",
    existing?.settler,
    force.has("settler"),
  );

  const deployments = {
    network: "algorand:testnet",
    deployedAt: new Date().toISOString(),
    authorityAddress: account.addr.toString(),
    registry: { appId: registry.appId, address: registry.address },
    pool: { appId: pool.appId, address: pool.address },
    settler: { appId: settler.appId, address: settler.address },
  };

  writeFileSync(outPath, JSON.stringify(deployments, null, 2));
  console.log(`[deploy] wrote ${outPath}`);
  console.log(`[deploy] view txs on https://lora.algokit.io/testnet`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
