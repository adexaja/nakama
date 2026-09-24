import { expect, test } from "bun:test";
import { getMfaEncryptionKey } from "../services/mfa-config";
import {
  createTotpCode,
  encryptTotpSecret,
  generateTotpSecret,
  hashBackupCode,
} from "../services/mfa-crypto";
import { setupTestConfigDir } from "../test-config-dir";
import { createMinimalHonoApp } from "./test-app-helpers";
import type { AppFetch } from "./test-session-helpers";
import { setupFreshInstallSession } from "./test-session-helpers";

setupTestConfigDir("nakama-platform-mfa-test-");

test("platform admin configures MFA and login requires the user's TOTP", async () => {
  const { app, databaseAdapter } = createMinimalHonoApp();
  const session = await setupFreshInstallSession(
    app as AppFetch,
    databaseAdapter
  );

  const policyResponse = await app.fetch(
    new Request("http://localhost:4310/v1/settings/mfa", {
      body: JSON.stringify({ enabled: true, required: true }),
      headers: session.headers({
        "Content-Type": "application/json",
        "X-CSRF-Token": session.csrfToken,
      }),
      method: "PUT",
    })
  );
  expect(policyResponse.status).toBe(200);
  expect(await policyResponse.json()).toMatchObject({
    enabled: true,
    enforcedRoles: ["admin", "member", "viewer"],
    keyConfigured: true,
    required: true,
  });

  const user = await databaseAdapter.getUserByEmail("admin@example.com");
  if (!user) {
    throw new Error("Expected setup user");
  }

  const unenrolledLogin = await app.fetch(
    new Request("http://localhost:4310/v1/auth/login", {
      body: JSON.stringify({
        email: "admin@example.com",
        password: "password123",
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    })
  );
  expect(unenrolledLogin.status).toBe(200);
  expect(await unenrolledLogin.json()).toMatchObject({
    mfaEnrolled: false,
    mfaRequired: true,
  });

  const memberOnlyPolicy = await app.fetch(
    new Request("http://localhost:4310/v1/settings/mfa", {
      body: JSON.stringify({ enforcedRoles: ["member"] }),
      headers: session.headers({
        "Content-Type": "application/json",
        "X-CSRF-Token": session.csrfToken,
      }),
      method: "PUT",
    })
  );
  expect(memberOnlyPolicy.status).toBe(200);
  const memberOnlyLogin = await app.fetch(
    new Request("http://localhost:4310/v1/auth/login", {
      body: JSON.stringify({
        email: "admin@example.com",
        password: "password123",
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    })
  );
  expect(await memberOnlyLogin.json()).toMatchObject({
    mfaRequired: false,
  });
  const adminOnlyPolicy = await app.fetch(
    new Request("http://localhost:4310/v1/settings/mfa", {
      body: JSON.stringify({ enforcedRoles: ["admin"] }),
      headers: session.headers({
        "Content-Type": "application/json",
        "X-CSRF-Token": session.csrfToken,
      }),
      method: "PUT",
    })
  );
  expect(adminOnlyPolicy.status).toBe(200);
  const secret = generateTotpSecret();

  await databaseAdapter.updateUserMfa(
    user.id,
    { enabled: true, totpSecretEnc: encryptTotpSecret(secret) },
    new Date().toISOString()
  );
  const mfaEncryptionKey = getMfaEncryptionKey();
  await databaseAdapter.createMfaBackupCode({
    codeHash: hashBackupCode("BACKUP-123", mfaEncryptionKey),
    createdAt: new Date().toISOString(),
    id: "backup-123",
    usedAt: null,
    userId: user.id,
  });

  const missingCode = await app.fetch(
    new Request("http://localhost:4310/v1/auth/login", {
      body: JSON.stringify({
        email: "admin@example.com",
        password: "password123",
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    })
  );
  expect(missingCode.status).toBe(401);

  const validCode = await app.fetch(
    new Request("http://localhost:4310/v1/auth/login", {
      body: JSON.stringify({
        email: "admin@example.com",
        mfaCode: createTotpCode(secret),
        password: "password123",
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    })
  );
  expect(validCode.status).toBe(200);
  const backupLogin = await app.fetch(
    new Request("http://localhost:4310/v1/auth/login", {
      body: JSON.stringify({
        backupCode: "BACKUP-123",
        email: "admin@example.com",
        password: "password123",
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    })
  );
  expect(backupLogin.status).toBe(200);
  const reusedBackupLogin = await app.fetch(
    new Request("http://localhost:4310/v1/auth/login", {
      body: JSON.stringify({
        backupCode: "BACKUP-123",
        email: "admin@example.com",
        password: "password123",
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    })
  );
  expect(reusedBackupLogin.status).toBe(401);
  expect(await reusedBackupLogin.json()).toMatchObject({
    error: "Backup code is invalid or has already been used.",
  });
  await databaseAdapter.createMfaBackupCode({
    codeHash: hashBackupCode("STALE-BACKUP", mfaEncryptionKey),
    createdAt: new Date().toISOString(),
    id: "stale-backup",
    usedAt: null,
    userId: user.id,
  });

  const disableResponse = await app.fetch(
    new Request("http://localhost:4310/v1/auth/mfa/disable", {
      body: JSON.stringify({ code: createTotpCode(secret) }),
      headers: session.headers({
        "Content-Type": "application/json",
        "X-CSRF-Token": session.csrfToken,
      }),
      method: "POST",
    })
  );
  expect(disableResponse.status).toBe(200);

  const startResponse = await app.fetch(
    new Request("http://localhost:4310/v1/auth/mfa/totp/start", {
      headers: session.headers({ "X-CSRF-Token": session.csrfToken }),
      method: "POST",
    })
  );
  expect(startResponse.status).toBe(200);
  const startBody = (await startResponse.json()) as { secret: string };

  const verifyResponse = await app.fetch(
    new Request("http://localhost:4310/v1/auth/mfa/totp/verify", {
      body: JSON.stringify({ code: createTotpCode(startBody.secret) }),
      headers: session.headers({
        "Content-Type": "application/json",
        "X-CSRF-Token": session.csrfToken,
      }),
      method: "POST",
    })
  );
  expect(verifyResponse.status).toBe(200);
  const verifyBody = (await verifyResponse.json()) as { backupCodes: string[] };

  const staleBackupLogin = await app.fetch(
    new Request("http://localhost:4310/v1/auth/login", {
      body: JSON.stringify({
        backupCode: "STALE-BACKUP",
        email: "admin@example.com",
        password: "password123",
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    })
  );
  expect(staleBackupLogin.status).toBe(401);
  expect(await staleBackupLogin.json()).toMatchObject({
    error: "Backup code is invalid or has already been used.",
  });
  const disableWithBackupResponse = await app.fetch(
    new Request("http://localhost:4310/v1/auth/mfa/disable", {
      body: JSON.stringify({ backupCode: verifyBody.backupCodes[0] }),
      headers: session.headers({
        "Content-Type": "application/json",
        "X-CSRF-Token": session.csrfToken,
      }),
      method: "POST",
    })
  );
  expect(disableWithBackupResponse.status).toBe(200);
});
