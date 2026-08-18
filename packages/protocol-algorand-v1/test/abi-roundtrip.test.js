import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import assert from "node:assert/strict";
import { ABIContract } from "algosdk";
import {
  encodeDepositEscrow,
  encodeGetEndpoint,
  encodeIsSettled,
  encodeProtocolPaused,
  encodeRegisterEndpoint,
  encodeSettleBatch,
  encodeSlug,
  encodeSlugAt,
  encodeSlugCount,
  encodeTopUp,
} from "x500-protocol-algorand-v1-client";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const artifactsDir = join(root, "artifacts");

function arc32Contract(contractName) {
  const arc32 = JSON.parse(
    readFileSync(join(artifactsDir, `${contractName}.arc32.json`), "utf8"),
  );
  return arc32.contract;
}

function selectorFromArc32(contractName, methodName) {
  const contract = arc32Contract(contractName);
  const method = contract.methods.find((m) => m.name === methodName);
  if (!method) throw new Error(`missing ${methodName} on ${contractName}`);
  const abi = new ABIContract({
    name: contract.name,
    methods: [method],
  });
  return Buffer.from(abi.getMethodByName(methodName).getSelector()).toString("hex");
}

function selectorHex(encoded) {
  return Buffer.from(encoded[0].slice(0, 4)).toString("hex");
}

test("compiled artifacts exist", () => {
  for (const name of ["X500Registry", "X500Pool", "X500Settler"]) {
    assert.ok(
      readFileSync(join(artifactsDir, `${name}.approval.teal`), "utf8").length > 0,
    );
    assert.ok(
      readFileSync(join(artifactsDir, `${name}.clear.teal`), "utf8").length > 0,
    );
  }
});

test("ABI method selectors match encoders", () => {
  const checks = [
    {
      contract: "X500Registry",
      method: "register_endpoint",
      encoded: encodeRegisterEndpoint({
        slug: "pay-default",
        hostname: "example.com",
        apiPriceMicroUsdc: 5000n,
        contactAddress: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ",
        slaLatencyMs: 60000,
      }),
    },
    {
      contract: "X500Registry",
      method: "get_endpoint",
      encoded: encodeGetEndpoint("pay-default"),
    },
    {
      contract: "X500Registry",
      method: "slug_count",
      encoded: encodeSlugCount(),
    },
    {
      contract: "X500Registry",
      method: "slug_at",
      encoded: encodeSlugAt(0),
    },
    {
      contract: "X500Registry",
      method: "protocol_paused",
      encoded: encodeProtocolPaused(),
    },
    {
      contract: "X500Pool",
      method: "deposit_escrow",
      encoded: encodeDepositEscrow(),
    },
    {
      contract: "X500Pool",
      method: "top_up",
      encoded: encodeTopUp("pay-default"),
    },
    {
      contract: "X500Settler",
      method: "is_settled",
      encoded: encodeIsSettled("00000000-0000-0000-0000-000000000001"),
    },
    {
      contract: "X500Settler",
      method: "settle_batch",
      encoded: encodeSettleBatch([
        {
          callId: "00000000-0000-0000-0000-000000000001",
          agentAddress:
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ",
          endpointSlug: "pay-default",
          premiumMicroAlgos: 1_000_000n,
          refundMicroAlgos: 500_000n,
          latencyMs: 100,
          breach: true,
          feeRecipientCountHint: 1,
          timestampSec: 1_700_000_000n,
        },
      ]),
    },
  ];

  for (const { contract, method, encoded } of checks) {
    const arcSelector = selectorFromArc32(contract, method);
    const encSelector = selectorHex(encoded);
    assert.equal(encSelector, arcSelector, `${contract}.${method} selector mismatch`);
  }
});

test("encodeSlug is 16 bytes right-padded", () => {
  const slug = encodeSlug("pay-default");
  assert.equal(slug.length, 16);
  assert.equal(
    Buffer.from(slug).toString("utf8").replace(/\0/g, ""),
    "pay-default",
  );
});
