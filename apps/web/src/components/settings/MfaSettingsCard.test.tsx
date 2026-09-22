import { expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { AuthContext } from "@/context/auth-context-shared";
import { MfaSettingsCard } from "./MfaSettingsCard";

test("MFA settings offers authenticator and passkey enrollment", () => {
  const html = renderToString(
    <AuthContext.Provider
      value={{
        activeOrg: null,
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
        user: {
          email: "mfa@example.com",
          id: "user-1",
          mfaEnabled: false,
        },
      }}
    >
      <MfaSettingsCard />
    </AuthContext.Provider>
  );

  expect(html).toContain("Set up authenticator");
  expect(html).toContain("Enroll passkey");
  expect(html).not.toContain("Authenticator QR code");
});
