import { describe, expect, it } from "vitest";
import { abiReturnFromSimulate } from "x500-protocol-algorand-v1-client";

describe("abiReturnFromSimulate", () => {
  it("reads ARC-4 return from the last log", () => {
    const payload = Buffer.from("hello");
    const log = Buffer.concat([Buffer.from("151f7c75", "hex"), payload]);
    const ret = abiReturnFromSimulate({
      txnGroups: [
        {
          txnResults: [{ txnResult: { logs: [log] } }],
        },
      ],
    });
    expect(Buffer.from(ret ?? []).toString()).toBe("hello");
  });

  it("throws on simulate failure", () => {
    expect(() =>
      abiReturnFromSimulate({
        txnGroups: [{ failureMessage: "invalid Box reference", txnResults: [] }],
      }),
    ).toThrow(/invalid Box reference/);
  });
});
