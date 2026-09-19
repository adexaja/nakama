import { describe, expect, test } from "bun:test";
import { TelegramManagedBotPairingService } from "./telegram-managed-bot-pairing";

function fakeTelegramFetch() {
  let calls = 0;
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = String(input).split("/").at(-1);
    if (method === "getMe") {
      return Response.json({
        ok: true,
        result: { username: "NakamaManagerBot" },
      });
    }
    if (method === "getUpdates") {
      calls += 1;
      return Response.json({
        ok: true,
        result:
          calls === 1
            ? [
                {
                  managed_bot: {
                    bot: { id: 42, username: "renamed_bot" },
                    user: { id: 77 },
                  },
                  update_id: 1,
                },
              ]
            : [],
      });
    }
    if (method === "getManagedBotToken") {
      expect(init?.body).toContain('"user_id":42');
      return Response.json({ ok: true, result: "42:secret" });
    }
    throw new Error(`unexpected Telegram method: ${method}`);
  };
}

describe("TelegramManagedBotPairingService", () => {
  test("pairs a renamed managed bot and keeps it org scoped", async () => {
    const service = new TelegramManagedBotPairingService(
      "manager-token",
      fakeTelegramFetch()
    );
    const started = await service.start("org-a", "user-a", "profile-a");

    await expect(
      service.status(started.pairingId, "org-b", "user-a")
    ).rejects.toThrow("not found");

    const ready = await service.status(started.pairingId, "org-a", "user-a");
    expect(ready).toMatchObject({
      botUsername: "renamed_bot",
      ownerUserId: 77,
      status: "ready",
    });

    let saved: Record<string, string> | undefined;
    const applied = await service.apply(
      started.pairingId,
      "org-a",
      "user-a",
      "profile-b",
      async (input) => {
        saved = input;
      }
    );
    expect(applied.status).toBe("applied");
    expect(saved).toEqual({
      allowedUserIds: "77",
      botToken: "42:secret",
      profileId: "profile-b",
    });
  });

  test("cancels an active pairing", async () => {
    const service = new TelegramManagedBotPairingService(
      "manager-token",
      async () =>
        Response.json({
          ok: true,
          result: { username: "ManagerBot" },
        })
    );
    const started = await service.start("org-a", "user-a", "profile-a");
    expect(service.cancel(started.pairingId, "org-a", "user-a").status).toBe(
      "cancelled"
    );
  });
});
