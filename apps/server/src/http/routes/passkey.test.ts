import { describe, expect, test } from "bun:test";
import { createMinimalHonoApp } from "../test-app-helpers";
import { setupFreshInstallSession } from "../test-session-helpers";

async function startRegistration() {
  const { app, databaseAdapter } = createMinimalHonoApp();
  const session = await setupFreshInstallSession(app, databaseAdapter);
  const response = await app.fetch(
    new Request("http://localhost:4310/v1/auth/passkey/registration/options", {
      headers: session.headers({
        "Content-Type": "application/json",
        "X-CSRF-Token": session.csrfToken,
      }),
      method: "POST",
    })
  );
  return { app, databaseAdapter, response, session };
}

describe("passkey ceremony routes", () => {
  test("returns registration options backed by a persisted challenge", async () => {
    const { databaseAdapter, response } = await startRegistration();
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      challengeId: string;
      options: { challenge: string };
    };
    expect(body.challengeId).toBeString();
    expect(body.options.challenge).toBeString();
    await expect(
      databaseAdapter.getMfaChallenge(body.challengeId)
    ).resolves.toMatchObject({
      challenge: body.options.challenge,
      type: "registration",
    });
  });
  test("passkey login options are public and bind a challenge to the user", async () => {
    const { app, databaseAdapter } = createMinimalHonoApp();
    await setupFreshInstallSession(app, databaseAdapter);
    const user = await databaseAdapter.getUserByEmail("admin@example.com");
    if (!user) {
      throw new Error("setup user missing");
    }
    await databaseAdapter.createPasskey({
      backedUp: false,
      counter: 0,
      createdAt: user.createdAt,
      credentialId: "login-credential",
      deviceType: "multiDevice",
      id: "login-passkey",
      lastUsedAt: null,
      publicKey: "public-key-only",
      transports: ["internal"],
      userId: user.id,
    });
    const response = await app.fetch(
      new Request("http://localhost:4310/v1/auth/passkey/login/options", {
        body: JSON.stringify({ email: user.email }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      })
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { challengeId: string };
    await expect(
      databaseAdapter.getMfaChallenge(body.challengeId)
    ).resolves.toMatchObject({
      type: "authentication",
      userId: user.id,
    });
    const verify = () =>
      app.fetch(
        new Request("http://localhost:4310/v1/auth/passkey/login/verify", {
          body: JSON.stringify({ challengeId: body.challengeId, response: {} }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        })
      );
    expect((await verify()).status).toBe(401);
    expect((await verify()).status).toBe(400);
  });

  test("failed verification consumes the challenge and cannot be replayed", async () => {
    const { app, response, session } = await startRegistration();
    const { challengeId } = (await response.json()) as { challengeId: string };
    const request = () =>
      app.fetch(
        new Request(
          "http://localhost:4310/v1/auth/passkey/registration/verify",
          {
            body: JSON.stringify({ challengeId, response: {} }),
            headers: session.headers({
              "Content-Type": "application/json",
              "X-CSRF-Token": session.csrfToken,
            }),
            method: "POST",
          }
        )
      );
    expect((await request()).status).toBe(400);
    expect((await request()).status).toBe(400);
  });
});
