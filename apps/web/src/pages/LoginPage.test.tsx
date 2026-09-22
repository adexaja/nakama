import { expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { AppContext } from "@/context/app-context-shared";
import { AuthContext } from "@/context/auth-context-shared";
import { ThemeContext } from "@/context/theme-context-shared";
import { LoginPage } from "@/pages/LoginPage";

const auth = {
  activeOrg: null,
  archiveOrg: async () => {},
  createOrg: async () => {},
  isAuthenticated: false,
  isLoading: false,
  login: async () => {},
  logout: async () => {},
  orgs: [],
  refreshSession: async () => {},
  setup: async () => {},
  switchOrg: async () => {},
  updateOrg: async () => {},
  user: null,
};

const theme = {
  resolvedTheme: "light" as const,
  setTheme: () => undefined,
  theme: "system" as const,
  toggleTheme: () => undefined,
};
const app = {
  configureProvider: async () => ({
    currentModel: "test-model",
    displayName: "Test",
    provider: "openrouter" as const,
  }),
  createProvider: async () => ({
    defaultProviderId: "provider-1",
    initialModel: "test-model",
    provider: {
      createdAt: "2026-01-01T00:00:00.000Z",
      hasApiKey: true,
      id: "provider-1",
      label: "Test",
      modelCount: 1,
      type: "openrouter" as const,
    },
  }),
  error: null,
  health: {
    apiVersion: 1 as const,
    composioAvailable: false,
    composioConfigured: false,
    ok: true as const,
    providerConfigured: true,
    userConfigured: true,
    version: "test",
  },
  loading: false,
  models: null,
};

test("login presents passkey first with a visible fallback", () => {
  const html = renderToString(
    <AppContext.Provider value={app}>
      <AuthContext.Provider value={auth}>
        <ThemeContext.Provider value={theme}>
          <MemoryRouter>
            <LoginPage />
          </MemoryRouter>
        </ThemeContext.Provider>
      </AuthContext.Provider>
    </AppContext.Provider>
  );

  expect(html).toContain("Continue with passkey");
  expect(html).toContain("Use another method");
});
