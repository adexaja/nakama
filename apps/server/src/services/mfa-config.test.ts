import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { ensureMfaEncryptionKey } from "./mfa-config";

test("creates and reuses the MFA encryption key in the security config section", async () => {
  const previous = process.env.NAKAMA_CONFIG_DIR;
  const configDir = await mkdtemp(join(import.meta.dir, "mfa-config-"));
  process.env.NAKAMA_CONFIG_DIR = configDir;
  try {
    const first = await ensureMfaEncryptionKey("org_test");
    const second = await ensureMfaEncryptionKey("org_test");
    const config = await readFile(
      join(configDir, "orgs", "org_test", "config.ini"),
      "utf8"
    );

    expect(first).toHaveLength(43);
    expect(second).toBe(first);
    expect(config).toContain("[security]");
    expect(config).toContain(`mfa_encryption_key=${first}`);
  } finally {
    if (previous === undefined) {
      delete process.env.NAKAMA_CONFIG_DIR;
    } else {
      process.env.NAKAMA_CONFIG_DIR = previous;
    }
    await rm(configDir, { force: true, recursive: true });
  }
});
