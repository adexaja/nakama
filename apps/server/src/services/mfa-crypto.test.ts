import { describe, expect, test } from "bun:test";
import { createTotpCode, verifyTotpCode } from "./mfa-crypto";

describe("TOTP", () => {
  test("verifies the RFC-compatible code within clock drift", () => {
    const secret = "JBSWY3DPEHPK3PXP";
    const timestamp = 1_700_000_000_000;
    const code = createTotpCode(secret, timestamp);
    expect(code).toHaveLength(6);
    expect(verifyTotpCode(secret, code, timestamp + 29_000)).toBe(true);
    expect(verifyTotpCode(secret, "000000", timestamp)).toBe(false);
  });
});
