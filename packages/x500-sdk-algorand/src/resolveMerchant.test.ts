import { describe, expect, it } from "vitest";
import {
  normalizeMerchantOrigin,
  splitMerchantUrl,
} from "./resolveMerchant.js";

describe("resolveMerchant helpers", () => {
  it("normalizes merchant origin", () => {
    expect(normalizeMerchantOrigin("https://api.example.com/")).toBe(
      "https://api.example.com",
    );
    expect(normalizeMerchantOrigin("api.example.com")).toBe(
      "https://api.example.com",
    );
  });

  it("splits merchant URL into origin and path", () => {
    expect(
      splitMerchantUrl("https://ngrok.app/random?x=1"),
    ).toEqual({
      origin: "https://ngrok.app",
      path: "random?x=1",
    });
  });
});
