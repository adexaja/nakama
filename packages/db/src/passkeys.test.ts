import { describe, expect, test } from "bun:test";
import { createSqliteMemoryAdapter } from "./adapters/sqlite";

describe("passkey persistence", () => {
  const user = {
    createdAt: "2026-01-01T00:00:00.000Z",
    email: "passkey@example.com",
    id: "user-passkey",
    passwordHash: "unused",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };

  test("challenge consumption is single-use and rejects expiry", async () => {
    const db = createSqliteMemoryAdapter();
    await db.createUser(user);
    await db.createMfaChallenge({
      challenge: "live-challenge",
      createdAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2026-01-01T00:05:00.000Z",
      id: "live",
      type: "authentication",
      userId: user.id,
    });
    expect(
      await db.consumeMfaChallenge(
        "live",
        user.id,
        "authentication",
        "2026-01-01T00:01:00.000Z"
      )
    ).toMatchObject({ challenge: "live-challenge" });
    expect(
      await db.consumeMfaChallenge(
        "live",
        user.id,
        "authentication",
        "2026-01-01T00:01:00.000Z"
      )
    ).toBeNull();

    await db.createMfaChallenge({
      challenge: "expired-challenge",
      createdAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2026-01-01T00:05:00.000Z",
      id: "expired",
      type: "registration",
      userId: user.id,
    });
    expect(
      await db.consumeMfaChallenge(
        "expired",
        user.id,
        "registration",
        "2026-01-01T00:05:00.001Z"
      )
    ).toBeNull();
    expect(await db.getMfaChallenge("expired")).toBeNull();
  });

  test("credential counter updates persist for replay protection", async () => {
    const db = createSqliteMemoryAdapter();
    await db.createUser(user);
    await db.createPasskey({
      backedUp: false,
      counter: 3,
      createdAt: user.createdAt,
      credentialId: "credential-id",
      deviceType: "singleDevice",
      id: "passkey-id",
      lastUsedAt: null,
      publicKey: "public-key-only",
      transports: ["internal"],
      userId: user.id,
    });
    expect(
      await db.updatePasskeyCounter("passkey-id", 4, "2026-01-01T00:01:00.000Z")
    ).toBe(true);
    await expect(
      db.getPasskeyByCredentialId("credential-id")
    ).resolves.toMatchObject({
      counter: 4,
      lastUsedAt: "2026-01-01T00:01:00.000Z",
    });
    expect(
      await db.updatePasskeyCounter("passkey-id", 4, "2026-01-01T00:02:00.000Z")
    ).toBe(false);
  });
});
