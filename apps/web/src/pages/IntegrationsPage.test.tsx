import { expect, spyOn, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { TelegramSettingsCard } from "@/components/TelegramSettingsCard";
import { WorkerActionBar } from "@/components/WorkerActionBar";
import { useActiveChatProfileStore } from "@/context/active-chat-profile-store";
import {
  AuthContext,
  type AuthContextValue,
} from "@/context/auth-context-shared";
import { ChannelProfileContext } from "@/hooks/use-app-queries";
import { client } from "@/lib/client";
import { queryKeys } from "@/lib/query-keys";
import { IntegrationsPage } from "./IntegrationsPage";
import {
  ProfileChannelSettingsPage,
  ProfileConnections,
} from "./profiles/profile-config-tab";

test("connection setup uses the sidebar agent, preserves failures, and disappears after assignment", async () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
    },
  });
  const auth: AuthContextValue = {
    activeOrg: {
      createdAt: "",
      id: "org-setup",
      name: "Setup",
      role: "admin",
      slug: "setup",
      updatedAt: "",
    },
    archiveOrg: async () => {},
    createOrg: async () => {},
    isAuthenticated: true,
    isLoading: false,
    login: async () => {},
    logout: async () => {},
    orgs: [],
    refreshSession: async () => {},
    setup: async () => {},
    switchOrg: async () => {},
    updateOrg: async () => {},
    user: { email: "admin@example.com", id: "admin", isPlatformAdmin: true },
  };
  const previous = useActiveChatProfileStore.getState();
  useActiveChatProfileStore.setState({
    orgId: "org-setup",
    profileId: "agent-a",
  });
  const profiles = [
    { id: "agent-a", name: "Alpha" },
    { id: "agent-b", name: "Beta" },
  ];
  queryClient.setQueryData(queryKeys.profiles.all, profiles);
  const api = client.forOrg("org-setup");
  const scope = spyOn(client, "forOrg").mockReturnValue(api);
  let assigned = false;
  const list = spyOn(api, "listLegacyChannels").mockImplementation(async () =>
    assigned ? [] : [{ global: true, platform: "telegram" }]
  );
  const listProfiles = spyOn(client, "listProfiles").mockResolvedValue({
    profiles,
  } as Awaited<ReturnType<typeof client.listProfiles>>);
  const claim = spyOn(api, "claimLegacyChannel")
    .mockRejectedValueOnce(new Error("Assignment failed"))
    .mockImplementationOnce(async () => {
      assigned = true;
      return { ok: true };
    });
  const restart = spyOn(api, "restartWorker").mockResolvedValue({ ok: true });
  const settings = spyOn(api, "getDiscordSettings").mockRejectedValue(
    new Error("Unavailable")
  );
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
  const assignButton = () =>
    [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.startsWith("Assign to")
    )!;
  try {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <AuthContext.Provider value={auth}>
            <MemoryRouter>
              <IntegrationsPage />
            </MemoryRouter>
          </AuthContext.Provider>
        </QueryClientProvider>
      );
      await settle();
    });
    await act(settle);
    expect(container.querySelector("select")).toBeNull();
    expect(assignButton().textContent).toContain("Alpha");
    await act(async () =>
      useActiveChatProfileStore.setState({ profileId: "agent-b" })
    );
    expect(assignButton().textContent).toContain("Beta");
    await act(async () => {
      assignButton().click();
      await settle();
    });
    expect(claim).toHaveBeenLastCalledWith("telegram", true, "agent-b");
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(
      container.querySelector('[aria-label="Connection setup"]')
    ).not.toBeNull();
    await act(async () => {
      assignButton().click();
      await settle();
    });
    await act(settle);
    expect(
      container.querySelector('[aria-label="Connection setup"]')
    ).toBeNull();
    expect(container.querySelector("a")?.getAttribute("href")).toContain(
      "agent-b"
    );
    await act(async () =>
      useActiveChatProfileStore.setState({ orgId: "other-org" })
    );
    expect(container.querySelector("a")).toBeNull();

    queryClient.setQueryData(
      [...queryKeys.systemStatus, "org-setup", "agent-b"],
      {
        discordWorker: {
          configured: false,
          connected: false,
          paired: false,
          running: false,
        },
        telegramWorker: { configured: true, paired: true, running: true },
        whatsappWorker: {
          configured: true,
          connected: false,
          paired: true,
          running: true,
        },
      }
    );
    await act(async () =>
      root.render(
        <QueryClientProvider client={queryClient}>
          <AuthContext.Provider value={auth}>
            <MemoryRouter>
              <Routes>
                <Route
                  element={
                    <ChannelProfileContext.Provider value="agent-b">
                      <ProfileConnections agentName="Beta" />
                    </ChannelProfileContext.Provider>
                  }
                  path="/"
                />
                <Route
                  element={<ProfileChannelSettingsPage />}
                  path="/profiles/:profileId/channels/:channel"
                />
              </Routes>
            </MemoryRouter>
          </AuthContext.Provider>
        </QueryClientProvider>
      )
    );
    expect(container.querySelectorAll("img")).toHaveLength(3);
    expect(
      container.querySelector('[aria-label="Settings Telegram"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[aria-label="Settings WhatsApp"]')?.textContent
    ).toContain("Offline");
    expect(
      container.querySelector('[aria-label="Connect Telegram"]')
    ).toBeNull();
    expect(
      container.querySelector('[aria-label="Settings Telegram"]')?.textContent
    ).toContain("Connected");
    expect(
      container.querySelector('[aria-label="Settings WhatsApp"]')?.textContent
    ).not.toContain("Connected");
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    await act(async () => {
      (
        container.querySelector(
          '[aria-label="Connect Discord"] img'
        ) as HTMLImageElement
      ).click();
      await settle();
    });
    await act(settle);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(container.querySelector("h1")).not.toBeNull();
    expect(container.querySelector("a")?.getAttribute("href")).toBe(
      "/profiles?profile=agent-b#profile-connections"
    );
    expect(settings).toHaveBeenCalledWith("agent-b");
    expect(container.querySelector("details")?.open).toBe(true);
    await act(async () => {
      queryClient.setQueryData(
        [...queryKeys.discord.settings, "org-setup", "agent-b"],
        {
          allowedUserIds: [],
          botTokenMasked: "***",
          configured: true,
          handshakeCode: null,
          inviteUrl: null,
          pairedUserIds: ["123"],
          profileId: "agent-b",
        }
      );
      await settle();
    });
    await act(settle);
    expect(container.querySelector("details")?.open).toBe(false);
    expect(container.querySelector("#discord-profile")).toBeNull();
    expect(container.querySelector('[aria-label="Bot token"]')).not.toBeNull();
    expect(
      [...container.querySelectorAll("button")].some(
        (button) => button.textContent === "Save changes"
      )
    ).toBe(false);
    const editUsers = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Edit"
    );
    expect(editUsers?.closest("details")).toBeNull();
    expect(editUsers).toBeDefined();
    queryClient.setQueryData(
      [...queryKeys.telegram.settings, "org-setup", "agent-b"],
      {
        allowedUserIds: [],
        botTokenMasked: "***",
        configured: true,
        handshakeCode: null,
        pairedUserIds: [123],
        profileId: "agent-b",
      }
    );
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <AuthContext.Provider value={auth}>
            <ChannelProfileContext.Provider value="agent-b">
              <TelegramSettingsCard embedded />
            </ChannelProfileContext.Provider>
          </AuthContext.Provider>
        </QueryClientProvider>
      );
      await settle();
    });
    await act(settle);
    expect(container.querySelector("details")?.open).toBe(false);
    expect(container.querySelector("#telegram-profile")).toBeNull();
    expect(container.querySelector('[aria-label="Bot token"]')).not.toBeNull();
    expect(
      [...container.querySelectorAll("button")].some(
        (button) => button.textContent === "Save changes"
      )
    ).toBe(false);
    expect(
      [...container.querySelectorAll("button")]
        .find((button) => button.textContent === "Edit")
        ?.closest("details")
    ).toBeNull();

    await act(async () =>
      root.render(
        <QueryClientProvider client={queryClient}>
          <AuthContext.Provider value={auth}>
            <ChannelProfileContext.Provider value="agent-b">
              <WorkerActionBar
                compact
                pm2Managed
                running
                showLogs={false}
                workerName="whatsapp"
              />
            </ChannelProfileContext.Provider>
          </AuthContext.Provider>
        </QueryClientProvider>
      )
    );
    expect(
      [...container.querySelectorAll("button")].map(
        (button) => button.textContent
      )
    ).toEqual(["Disconnect", "More"]);
    await act(async () => {
      [...container.querySelectorAll("button")]
        .find((button) => button.textContent === "More")!
        .click();
      await settle();
    });
    await act(async () => {
      (document.querySelector('[role="menuitem"]') as HTMLElement).click();
      await settle();
    });
    expect(restart).toHaveBeenCalledWith("whatsapp", "agent-b");
  } finally {
    await act(async () => root.unmount());
    container.remove();
    queryClient.clear();
    scope.mockRestore();
    list.mockRestore();
    claim.mockRestore();
    listProfiles.mockRestore();
    settings.mockRestore();
    restart.mockRestore();
    useActiveChatProfileStore.setState(previous);
  }
});
