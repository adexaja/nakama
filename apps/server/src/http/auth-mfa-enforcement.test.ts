import { describe, expect, test } from "bun:test";
import {
  createTotpCode,
  encryptTotpSecret,
  ensureMfaEncryptionKey,
  generateTotpSecret,
  hashBackupCode,
} from "../services/mfa-crypto";
import { setupTestConfigDir } from "../test-config-dir";
import { createMinimalHonoApp } from "./test-app-helpers";
import { setupFreshInstallSession } from "./test-session-helpers";

setupTestConfigDir("nakama-http-auth-mfa-test-");

describe("authenticated MFA policy state", () => {
  test("regenerates backup codes after validating the current TOTP", async () => {
    const { app, databaseAdapter } = createMinimalHonoApp();
    const session = await setupFreshInstallSession(app, databaseAdapter);
    const user = await databaseAdapter.getUserByEmail("admin@example.com");
    await ensureMfaEncryptionKey();
    if (!user) {
      throw new Error("Expected setup user");
    }
    const secret = generateTotpSecret();
    await databaseAdapter.updateUserMfa(
      user.id,
      { enabled: true, totpSecretEnc: encryptTotpSecret(secret) },
      new Date().toISOString()
    );
    await databaseAdapter.createMfaBackupCode({
      codeHash: hashBackupCode("OLD-CODE"),
      createdAt: new Date().toISOString(),
      id: "old-backup-code",
      usedAt: null,
      userId: user.id,
    });

    const response = await app.fetch(
      new Request("http://localhost:4310/v1/auth/mfa/backup-codes/regenerate", {
        body: JSON.stringify({ code: createTotpCode(secret) }),
        headers: session.headers({
          "Content-Type": "application/json",
          "X-CSRF-Token": session.csrfToken,
        }),
        method: "POST",
      })
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { backupCodes: string[] };
    expect(body.backupCodes).toHaveLength(10);
    expect(
      (await databaseAdapter.listMfaBackupCodes(user.id)).find(
        (code) => code.id === "old-backup-code"
      )?.usedAt
    ).not.toBeNull();
  });

  test("reports an enrolled user under a required organization policy", async () => {
    const { app, databaseAdapter, orgService } = createMinimalHonoApp();
    const session = await setupFreshInstallSession(app, databaseAdapter);
    const user = await databaseAdapter.getUserByEmail("admin@example.com");
    if (!user) {
      throw new Error("Expected setup user");
    }

    await orgService.updateOrganization(session.orgId!, {
      mfaEnabled: true,
      mfaRequired: true,
    });
    await databaseAdapter.updateUserMfa(
      user.id,
      { enabled: true, totpSecretEnc: "configured" },
      new Date().toISOString()
    );

    const response = await app.fetch(
      new Request("http://localhost:4310/v1/auth/me", {
        headers: session.headers(),
      })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      mfaEnabled: true,
      mfaEnrolled: true,
      mfaOrgEnabled: true,
      mfaRequired: true,
    });
  });

  test("reports an unenrolled user under a required organization policy", async () => {
    const { app, databaseAdapter, orgService } = createMinimalHonoApp();
    const session = await setupFreshInstallSession(app, databaseAdapter);
    await orgService.updateOrganization(session.orgId!, {
      mfaEnabled: true,
      mfaRequired: true,
    });

    const response = await app.fetch(
      new Request("http://localhost:4310/v1/auth/me", {
        headers: session.headers(),
      })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      mfaEnabled: false,
      mfaEnrolled: false,
      mfaOrgEnabled: true,
      mfaRequired: true,
    });
  });
});
