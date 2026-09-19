import { randomUUID } from "node:crypto";

import type {
  TelegramPairingStartResponse,
  TelegramPairingStatusResponse,
} from "@nakama/core";

const PAIRING_TTL_MS = 10 * 60 * 1000;
const API_BASE = "https://api.telegram.org";

type PairingState = "waiting" | "ready" | "cancelled" | "applied";

type Pairing = {
  botId?: number;
  botUsername?: string;
  expiresAt: string;
  id: string;
  orgId: string;
  ownerUserId?: number;
  profileId: string;
  state: PairingState;
  suggestedUsername: string;
  userId: string;
  token?: string;
};

export class TelegramManagedBotPairingService {
  private readonly pairings = new Map<string, Pairing>();
  private offset = 0;
  private readonly pollTimer = setInterval(() => {
    if (
      [...this.pairings.values()].some((pairing) => pairing.state === "waiting")
    ) {
      void this.sync().catch(() => undefined);
    }
  }, 2000);
  private syncPromise: Promise<void> | null = null;

  constructor(
    private readonly managerToken = process.env
      .NAKAMA_TELEGRAM_MANAGER_BOT_TOKEN,
    private readonly request: (
      input: RequestInfo | URL,
      init?: RequestInit
    ) => Promise<Response> = fetch
  ) {
    this.pollTimer.unref?.();
  }

  async start(
    orgId: string,
    userId: string,
    profileId: string
  ): Promise<TelegramPairingStartResponse> {
    const manager = await this.call<{ username?: string }>("getMe");
    if (!manager.username) {
      throw new Error("Telegram manager bot is not configured.");
    }

    const id = randomUUID();
    const suggestedUsername = `nakama_${id.replaceAll("-", "").slice(0, 16)}_bot`;
    const expiresAt = new Date(Date.now() + PAIRING_TTL_MS).toISOString();
    const deepLink = `https://t.me/newbot/${manager.username}/${suggestedUsername}?name=Nakama`;
    this.pairings.set(id, {
      expiresAt,
      id,
      orgId,
      profileId,
      state: "waiting",
      suggestedUsername,
      userId,
    });

    return {
      deepLink,
      expiresAt,
      pairingId: id,
      qrPayload: deepLink,
      suggestedUsername,
    };
  }

  async status(
    pairingId: string,
    orgId: string,
    userId: string
  ): Promise<TelegramPairingStatusResponse> {
    const pairing = this.authorize(pairingId, orgId, userId);
    if (
      pairing.state === "waiting" &&
      Date.now() >= Date.parse(pairing.expiresAt)
    ) {
      pairing.state = "cancelled";
    }
    if (pairing.state === "waiting") {
      await this.sync();
    }
    return this.toResponse(pairing);
  }

  cancel(
    pairingId: string,
    orgId: string,
    userId: string
  ): TelegramPairingStatusResponse {
    const pairing = this.authorize(pairingId, orgId, userId);
    if (pairing.state === "waiting") {
      pairing.state = "cancelled";
    }
    return this.toResponse(pairing);
  }

  async apply(
    pairingId: string,
    orgId: string,
    userId: string,
    profileId: string,
    save: (input: {
      botToken: string;
      allowedUserIds: string;
      profileId: string;
    }) => Promise<void>
  ): Promise<TelegramPairingStatusResponse> {
    const pairing = this.authorize(pairingId, orgId, userId);
    if (
      pairing.state !== "ready" ||
      !pairing.token ||
      pairing.ownerUserId == null
    ) {
      throw new Error("Telegram bot is not ready to connect.");
    }
    await save({
      allowedUserIds: String(pairing.ownerUserId),
      botToken: pairing.token,
      profileId,
    });
    pairing.profileId = profileId;
    pairing.state = "applied";
    return this.toResponse(pairing);
  }

  private authorize(pairingId: string, orgId: string, userId: string): Pairing {
    const pairing = this.pairings.get(pairingId);
    if (!pairing || pairing.orgId !== orgId || pairing.userId !== userId) {
      throw new Error("Telegram pairing was not found.");
    }
    return pairing;
  }

  private toResponse(pairing: Pairing): TelegramPairingStatusResponse {
    return {
      botUsername: pairing.botUsername ?? null,
      expiresAt: pairing.expiresAt,
      ownerUserId: pairing.ownerUserId ?? null,
      pairingId: pairing.id,
      profileId: pairing.profileId,
      status:
        pairing.state === "cancelled" &&
        Date.now() >= Date.parse(pairing.expiresAt)
          ? "expired"
          : pairing.state,
    };
  }

  // This make sure pullUpdates run multiple times at once
  private async sync(): Promise<void> {
    if (this.syncPromise) {
      return this.syncPromise;
    }
    this.syncPromise = this.pullUpdates().finally(() => {
      this.syncPromise = null;
    });
    return this.syncPromise;
  }

  private async pullUpdates(): Promise<void> {
    const updates = await this.call<
      Array<{
        managed_bot?: {
          bot?: { id?: number; username?: string };
          user?: { id?: number };
        };
        update_id?: number;
      }>
    >("getUpdates", {
      allowed_updates: ["managed_bot"],
      limit: 100,
      ...(this.offset ? { offset: this.offset } : {}),
      timeout: 0,
    });
    for (const update of updates) {
      if (typeof update.update_id === "number") {
        this.offset = Math.max(this.offset, update.update_id + 1);
      }
      const managed = update.managed_bot;
      const bot = managed?.bot;
      const ownerUserId = managed?.user?.id;
      if (!bot?.id || ownerUserId == null) {
        continue;
      }
      const waiting = [...this.pairings.values()].filter(
        (pairing) => pairing.state === "waiting"
      );
      const pairing =
        waiting.find(
          (candidate) => candidate.suggestedUsername === bot.username
        ) ?? (waiting.length === 1 ? waiting[0] : undefined);
      if (!pairing) {
        continue;
      }
      pairing.botId = bot.id;
      pairing.botUsername = bot.username;
      pairing.ownerUserId = ownerUserId;
      pairing.token = await this.call<string>("getManagedBotToken", {
        user_id: bot.id,
      });
      pairing.state = "ready";
    }
  }

  private async call<T>(
    method: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    if (!this.managerToken) {
      throw new Error(
        "Telegram manager bot is not configured, please include NAKAMA_TELEGRAM_MANAGER_BOT_TOKEN in environment variable."
      );
    }
    const response = await this.request(
      `${API_BASE}/bot${encodeURIComponent(this.managerToken)}/${method}`,
      {
        body: body ? JSON.stringify(body) : undefined,
        headers: body ? { "content-type": "application/json" } : undefined,
        method: body ? "POST" : "GET",
        signal: AbortSignal.timeout(5000),
      }
    );
    const payload = (await response.json()) as {
      description?: string;
      ok?: boolean;
      result?: T;
    };
    if (!(response.ok && payload.ok && payload.result !== undefined)) {
      throw new Error(
        payload.description ?? "Telegram manager bot request failed."
      );
    }
    return payload.result;
  }
}

export const telegramManagedBotPairing = new TelegramManagedBotPairingService();
