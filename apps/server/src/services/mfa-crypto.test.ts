import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { ensureMfaEncryptionKey } from "./mfa-config";
import {
  createTotpCode,
  decryptTotpSecret,
  encryptTotpSecret,
  verifyTotpCode,
} from "./mfa-crypto";

test("encrypts and decrypts TOTP secrets with the org key", async () => {
  const previous = process.env.NAKAMA_CONFIG_DIR;
  const configDir = await mkdtemp(join(import.meta.dir, "mfa-crypto-"));
  process.env.NAKAMA_CONFIG_DIR = configDir;
  try {
    const orgId = "org_test";
    await ensureMfaEncryptionKey(orgId);
    const encrypted = encryptTotpSecret(orgId, "JBSWY3DPEHPK3PXP");
    expect(encrypted).not.toBe("JBSWY3DPEHPK3PXP");
    expect(decryptTotpSecret(orgId, encrypted)).toBe("JBSWY3DPEHPK3PXP");
  } finally {
    if (previous === undefined) {
      delete process.env.NAKAMA_CONFIG_DIR;
    } else {
      process.env.NAKAMA_CONFIG_DIR = previous;
    }
    await rm(configDir, { force: true, recursive: true });
  }
});

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
