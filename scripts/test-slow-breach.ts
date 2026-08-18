/**
 * Test slow merchant: expect latency_breach + refund via insured proxy.
 */
import { createX500, USDC_TESTNET_ASA_ID } from "../packages/x500-sdk-algorand/src/createX500.ts";
import { formatMicroUsdc } from "../example/agent/src/payment-log.ts";

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
  const address = process.env.ALGORAND_AGENT_ADDRESS?.trim();
  const mnemonic = process.env.ALGORAND_AGENT_MNEMONIC?.trim();
  if (!address || !mnemonic) throw new Error("agent creds required");

  const slowOrigin =
    process.env.X500_SLOW_MERCHANT_ORIGIN?.trim() || "http://127.0.0.1:8801";
  const url = `${slowOrigin.replace(/\/$/, "")}/paid/weather?city=London`;

  const x500 = createX500({ network: "testnet", address, mnemonic });
  console.log(`[slow-test] GET ${url}`);
  const t0 = Date.now();
  const res = await x500.fetch(url);
  const elapsed = Date.now() - t0;
  const body = await res.text();

  const callId = res.headers.get("x-x500-call-id");
  const premium = res.headers.get("x-x500-premium") ?? "0";
  const refund = res.headers.get("x-x500-refund") ?? "0";
  const outcome = res.headers.get("x-x500-outcome") ?? "";
  const asset = res.headers.get("x-x500-asset") ?? "";

  console.log(`[slow-test] status ${res.status} (${elapsed}ms)`);
  console.log(`[slow-test] outcome ${outcome}`);
  console.log(`[slow-test] premium ${formatMicroUsdc(premium)}`);
  console.log(`[slow-test] refund ${formatMicroUsdc(refund)}`);
  console.log(`[slow-test] callId ${callId}`);
  console.log(`[slow-test] body ${body.slice(0, 300)}`);

  const breachOk = outcome === "latency_breach";
  const refundOk = BigInt(refund) > 0n;
  const premiumOk = BigInt(premium) > 0n;
  const assetOk = asset === USDC_TESTNET_ASA_ID;

  if (callId) {
    for (let i = 0; i < 90; i++) {
      const data = (await x500.getCall(callId)) as {
        call?: { settlement_tx_id?: string | null; status?: string };
      };
      const tx = data?.call?.settlement_tx_id?.trim();
      if (tx) {
        console.log(`[slow-test] on-chain settlement tx ${tx}`);
        break;
      }
      if (i % 10 === 0) {
        console.log(
          `[slow-test] settlement wait ${i}s status=${data?.call?.status ?? "—"}`,
        );
      }
      await sleep(1000);
    }
  }

  await x500.close();

  const failed = !breachOk || !refundOk || !premiumOk || !assetOk || !res.ok;
  console.log("\n========== SLOW BREACH TEST ==========");
  console.log(breachOk ? "PASS" : "FAIL", "latency_breach outcome");
  console.log(premiumOk ? "PASS" : "FAIL", "insurance premium > 0");
  console.log(refundOk ? "PASS" : "FAIL", "refund > 0");
  console.log(assetOk ? "PASS" : "FAIL", "USDC asset");
  console.log(res.ok ? "PASS" : "FAIL", `HTTP ${res.status}`);
  if (failed) process.exit(1);
  console.log("ALL CHECKS PASSED");
}

main().catch((err) => {
  console.error("[slow-test] fatal", err);
  process.exit(1);
});
