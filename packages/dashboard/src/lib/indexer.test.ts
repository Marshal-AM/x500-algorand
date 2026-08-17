import { describe, expect, it } from "vitest";
import { formatMicroAlgos, formatMicroUsdc } from "./indexer.js";

describe("formatMicroAlgos", () => {
  it("formats microAlgos to 6dp ALGO", () => {
    expect(formatMicroAlgos(1_000_000)).toBe("1.000000");
    expect(formatMicroAlgos(10_000)).toBe("0.010000");
    expect(formatMicroAlgos(0)).toBe("0.000000");
  });
});

describe("formatMicroUsdc", () => {
  it("formats microUsdc to 6dp USDC", () => {
    expect(formatMicroUsdc(1_000_000)).toBe("1.000000");
    expect(formatMicroUsdc(10_000)).toBe("0.010000");
    expect(formatMicroUsdc(0)).toBe("0.000000");
  });
});
