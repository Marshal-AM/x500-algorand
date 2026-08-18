/**
 * Full E2E: insured fetch via local SDK against fast + slow example servers.
 */
import { createX500, USDC_TESTNET_ASA_ID } from "../packages/x500-sdk-algorand/src/createX500.ts";
import {
  formatMicroUsdc,
  logPaymentBreakdown,
} from "../example/agent/src/payment-log.ts";

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitSettlement(
  x500: ReturnType<typeof createX500>,
  callId: string,
  maxSec = 90,
): Promise<string | null> {
  for (let i = 0; i < maxSec; i++) {
    const data = (await x500.getCall(callId)) as {
      call?: {
        settlement_tx_id?: string | null;
        status?: string;
      };
    };
    const call = data?.call;
    const tx = call?.settlement_tx_id?.trim();
    if (tx) return tx;
    if (call?.status === "settled" && tx) return tx;
    if (i === 0 || i % 10 === 0) {
      console.log(
        `[e2e] settlement wait ${i}s — call ${call ? "found" : "missing"}, status=${call?.status ?? "—"}, tx=${tx ?? "—"}`,
      );
    }
    await sleep(1000);
  }
  return null;
}

type StepResult = { ok: boolean; label: string; detail?: string };

async function runCase(opts: {
  x500: ReturnType<typeof createX500>;
  label: string;
  origin: string;
  city: string;
  expectOutcome: string;
  expectRefund: boolean;
  maxWaitSec?: number;
}): Promise<StepResult[]> {
  const results: StepResult[] = [];
  const url = `${opts.origin.replace(/\/$/, "")}/paid/weather?city=${encodeURIComponent(opts.city)}`;

  console.log(`\n========== ${opts.label} ==========`);
  console.log(`GET ${url}`);

  const resolved = await opts.x500.resolveMerchant(opts.origin);
  results.push({
    ok: Boolean(resolved.slug),
    label: "resolveMerchant",
    detail: `slug=${resolved.slug}`,
  });

  const res = await opts.x500.fetch(url);
  const body = await res.text();
  console.log(`status ${res.status}`);
  console.log(`body ${body.slice(0, 400)}`);

  results.push({
    ok: res.ok,
    label: "HTTP response",
    detail: `status=${res.status}`,
  });

  const callId = res.headers.get("x-x500-call-id");
  const premium = res.headers.get("x-x500-premium") ?? "0";
  const refund = res.headers.get("x-x500-refund") ?? "0";
  const outcome = res.headers.get("x-x500-outcome") ?? "";
  const asset = res.headers.get("x-x500-asset") ?? "";
  const network = res.headers.get("x-x500-network") ?? "";

  results.push({
    ok: Boolean(callId),
    label: "x-x500-call-id",
    detail: callId ?? "missing",
  });
  results.push({
    ok: BigInt(premium) > 0n,
    label: "insurance premium",
    detail: formatMicroUsdc(premium),
  });
  results.push({
    ok: outcome === opts.expectOutcome,
    label: "outcome",
    detail: `${outcome} (expected ${opts.expectOutcome})`,
  });
  results.push({
    ok: asset === USDC_TESTNET_ASA_ID,
    label: "insurance asset",
    detail: asset,
  });
  results.push({
    ok: network === "algorand:testnet",
    label: "network",
    detail: network,
  });

  if (opts.expectRefund) {
    results.push({
      ok: BigInt(refund) > 0n,
      label: "refund amount",
      detail: formatMicroUsdc(refund),
    });
  }

  await logPaymentBreakdown({
    x500: opts.x500,
    res,
    bodyText: body,
    configuredApiPriceMicroUsdc: resolved.apiPriceMicroUsdc,
    routeLabel: opts.label,
  });

  if (callId) {
    const settleTx = await waitSettlement(
      opts.x500,
      callId,
      opts.maxWaitSec ?? 60,
    );
    results.push({
      ok: Boolean(settleTx),
      label: "on-chain settlement",
      detail: settleTx ?? "pending/timeout",
    });
  }

  return results;
}

async function main(): Promise<void> {
  const address =
    process.env.X500_AGENT_ADDRESS?.trim() ||
    process.env.ALGORAND_AGENT_ADDRESS?.trim();
  const mnemonic =
    process.env.ALGORAND_AGENT_MNEMONIC?.trim() ||
    process.env.X500_AGENT_MNEMONIC?.trim();
  if (!address || !mnemonic) {
    throw new Error(
      "Missing agent credentials (ALGORAND_AGENT_ADDRESS + ALGORAND_AGENT_MNEMONIC)",
    );
  }
  const fastOrigin =
    process.env.X500_MERCHANT_ORIGIN?.trim() || "http://127.0.0.1:8800";
  const slowOrigin =
    process.env.X500_SLOW_MERCHANT_ORIGIN?.trim() || "http://127.0.0.1:8801";

  const x500 = createX500({ network: "testnet", address, mnemonic });
  const walletUsdc = await x500.getBalance();
  console.log(`[e2e] agent ${address}`);
  console.log(`[e2e] wallet USDC ${formatMicroUsdc(walletUsdc.toString())}`);

  const all: StepResult[] = [];

  all.push(
    ...(await runCase({
      x500,
      label: "FAST server (expect ok)",
      origin: fastOrigin,
      city: "Paris",
      expectOutcome: "ok",
      expectRefund: false,
      maxWaitSec: 120,
    })),
  );

  all.push(
    ...(await runCase({
      x500,
      label: "SLOW server (expect latency_breach + refund)",
      origin: slowOrigin,
      city: "London",
      expectOutcome: "latency_breach",
      expectRefund: true,
      maxWaitSec: 90,
    })),
  );

  await x500.close();

  console.log("\n========== E2E SUMMARY ==========");
  let failed = 0;
  for (const r of all) {
    const mark = r.ok ? "PASS" : "FAIL";
    if (!r.ok) failed++;
    console.log(`${mark}  ${r.label}${r.detail ? ` — ${r.detail}` : ""}`);
  }
  console.log(`\n${failed === 0 ? "ALL CHECKS PASSED" : `${failed} CHECK(S) FAILED`}`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("[e2e] fatal", err);
  process.exit(1);
});
