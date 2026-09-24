import { expect, test } from "bun:test";
import { createSqliteMemoryAdapter } from "./adapters/sqlite";

test("creating a passkey challenge prunes an expired challenge with the same id", async () => {
  const db = createSqliteMemoryAdapter();
  const now = "2026-01-01T00:00:00.000Z";
  const expiresAt = "2026-01-01T00:05:00.000Z";

  await db.createUser({
    createdAt: now,
    email: "passkey@example.com",
    id: "user_passkey",
    passwordHash: "unused",
    updatedAt: now,
  });
  await db.createPasskeyChallenge({
    challenge: "reused-challenge",
    createdAt: "2025-12-31T23:55:00.000Z",
    expiresAt: "2025-12-31T23:59:00.000Z",
    type: "authentication",
    userId: "user_passkey",
  });

  await db.createPasskeyChallenge({
    challenge: "reused-challenge",
    createdAt: now,
    expiresAt,
    type: "authentication",
    userId: "user_passkey",
  });

  await expect(
    db.consumePasskeyChallenge(
      "reused-challenge",
      "user_passkey",
      "authentication",
      now
    )
  ).resolves.toBe(true);
});
