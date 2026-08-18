/**
 * Send ALGO from operator to settler, agent, merchant (bypasses dispenser daily limit).
 */
import algosdk from "algosdk";

const mnemonic = process.env.ALGORAND_OPERATOR_MNEMONIC?.trim();
if (!mnemonic) {
  console.error("[fund-from-operator] ALGORAND_OPERATOR_MNEMONIC required");
  process.exit(1);
}

const account = algosdk.mnemonicToSecretKey(mnemonic);
const algod = new algosdk.Algodv2(
  "",
  process.env.ALGORAND_ALGOD_URL?.trim() ??
    "https://testnet-api.algonode.cloud",
  "",
);

const microPerAlgo = 1_000_000;
const algoEach = Number(process.env.X500_FUND_ALGO_EACH ?? 1);
const amount = algoEach * microPerAlgo;

const recipients = [
  { role: "settler", addr: process.env.ALGORAND_SETTLER_ADDRESS?.trim() },
  { role: "agent", addr: process.env.ALGORAND_AGENT_ADDRESS?.trim() },
  { role: "merchant", addr: process.env.ALGORAND_MERCHANT_ADDRESS?.trim() },
].filter((r): r is { role: string; addr: string } => Boolean(r.addr));

async function main(): Promise<void> {
  for (const { role, addr } of recipients) {
    const before = await algod.accountInformation(addr).do();
    if (Number(before.amount) >= amount) {
      console.log(
        `[fund-from-operator] ${role} already has ${Number(before.amount) / microPerAlgo} ALGO, skip`,
      );
      continue;
    }
    const params = await algod.getTransactionParams().do();
    const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: account.addr,
      receiver: addr,
      amount,
      suggestedParams: params,
    });
    const signed = txn.signTxn(account.sk);
    const { txId } = await algod.sendRawTransaction(signed).do();
    console.log(`[fund-from-operator] ${role} submitted tx=${txId}`);
    try {
      await algosdk.waitForConfirmation(algod, txId, 10);
    } catch {
      // testnet confirmation can lag; poll balance
      for (let i = 0; i < 20; i++) {
        const info = await algod.accountInformation(addr).do();
        if (Number(info.amount) >= amount) break;
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
    const info = await algod.accountInformation(addr).do();
    console.log(
      `[fund-from-operator] ${role} ${addr} balance=${Number(info.amount) / microPerAlgo} ALGO`,
    );
  }
  const op = await algod.accountInformation(account.addr.toString()).do();
  console.log(
    `[fund-from-operator] operator remaining=${Number(op.amount) / microPerAlgo} ALGO`,
  );
}

main().catch((err) => {
  console.error("[fund-from-operator] failed", err);
  process.exit(1);
});
