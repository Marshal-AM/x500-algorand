import { describe, expect, it } from "vitest";
import {
  parseX402PaymentAmountMicro,
  readX402AmountMicro,
} from "./x402PaymentAmount.js";

describe("readX402AmountMicro", () => {
  it("reads accepted.amount from a payment payload", () => {
    expect(
      readX402AmountMicro({
        x402Version: 2,
        accepted: { amount: "5000", asset: "10458941" },
      }),
    ).toBe(5_000n);
  });

  it("reads top-level amount from a settle receipt", () => {
    expect(readX402AmountMicro({ success: true, amount: "5000" })).toBe(5_000n);
  });
});

describe("parseX402PaymentAmountMicro", () => {
  it("prefers PAYMENT-SIGNATURE accepted.amount", () => {
    const sig = Buffer.from(
      JSON.stringify({
        accepted: { amount: "5000", extra: { asset: 10458941 } },
      }),
    ).toString("base64");
    const res = new Response("{}", {
      status: 200,
      headers: {
        "payment-response": Buffer.from(
          JSON.stringify({ success: true, payer: "X" }),
        ).toString("base64"),
      },
    });
    expect(
      parseX402PaymentAmountMicro(res, { "PAYMENT-SIGNATURE": sig }),
    ).toBe(5_000n);
  });

  it("reads PAYMENT-RESPONSE amount when signature has none", () => {
    const res = new Response("{}", {
      status: 200,
      headers: {
        "payment-response": Buffer.from(
          JSON.stringify({ success: true, amount: "5000" }),
        ).toString("base64"),
      },
    });
    expect(parseX402PaymentAmountMicro(res)).toBe(5_000n);
  });
});
