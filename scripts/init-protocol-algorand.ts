/**
 * Initialize x500 Algorand protocol after deploy.
 * - pool.init(settler_app_id)
 * - settler.init(pool_app_id, settler_authority)
 */
import algosdk from "algosdk";
import {
  encodePoolInit,
  encodeSettlerInit,
  encodeOptInUsdc,
} from "x500-protocol-algorand-v1-client";
import {
  deployments,
  operatorAccount,
  submitAppCall,
  algodClient,
} from "./lib/algorand.js";

async function main(): Promise<void> {
  const d = deployments();
  const account = operatorAccount();
  const settlerAuthority =
    process.env.ALGORAND_SETTLER_ADDRESS?.trim() ||
    (process.env.ALGORAND_SETTLER_MNEMONIC
      ? algosdk
          .mnemonicToSecretKey(
            process.env.ALGORAND_SETTLER_MNEMONIC.trim(),
          )
          .addr.toString()
      : account.addr.toString());

  console.log("[init] authority", account.addr.toString());
  console.log("[init] settler authority", settlerAuthority);
  console.log("[init] registry appId", d.registry.appId);
  console.log("[init] pool appId", d.pool.appId);
  console.log("[init] settler appId", d.settler.appId);

  const skipPoolInit = process.env.X500_SKIP_POOL_INIT?.trim() === "1";
  if (!skipPoolInit) {
    const poolTx = await submitAppCall({
      appId: d.pool.appId,
      appArgs: encodePoolInit(d.settler.appId),
    });
    console.log(`[ok] pool.init tx=${poolTx}`);
  } else {
    console.log("[init] skipping pool.init (X500_SKIP_POOL_INIT=1)");
  }

  const algod = algodClient();
  const poolAddr = algosdk.getApplicationAddress(d.pool.appId);
  const poolInfo = await algod.accountInformation(poolAddr).do();
  if (Number(poolInfo.amount) < 300_000) {
    const account = operatorAccount();
    const suggestedParams = await algod.getTransactionParams().do();
    const fundTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: account.addr,
      receiver: poolAddr,
      amount: 300_000,
      suggestedParams,
    });
    const signed = fundTxn.signTxn(account.sk);
    const { txid } = await algod.sendRawTransaction(signed).do();
    await algosdk.waitForConfirmation(algod, txid, 10);
    console.log(`[ok] pool ALGO fund tx=${txid}`);
  }

  const skipOptIn =
    process.env.X500_SKIP_POOL_OPT_IN?.trim() === "1" ||
    poolInfo.assets?.some((a) => Number(a["asset-id"]) === 10458941);

  if (!skipOptIn) {
    const optInTx = await submitAppCall({
      appId: d.pool.appId,
      appArgs: encodeOptInUsdc(),
      foreignAssets: [10458941],
      feeMicroAlgos: 3000,
    });
    console.log(`[ok] pool.opt_in_usdc tx=${optInTx}`);
  } else {
    console.log("[init] pool already opted into USDC, skipping opt_in_usdc");
  }

  const settlerTx = await submitAppCall({
    appId: d.settler.appId,
    appArgs: encodeSettlerInit(d.pool.appId, settlerAuthority),
  });
  console.log(`[ok] settler.init tx=${settlerTx}`);
}

main().catch((err) => {
  console.error("[fail] init-protocol-algorand", err);
  process.exit(1);
});
