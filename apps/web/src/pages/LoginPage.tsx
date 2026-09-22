import { Button } from "@nakama/ui/button";
import { Input } from "@nakama/ui/input";
import type { PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/browser";
import { startAuthentication } from "@simplewebauthn/browser";
import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAppContext } from "@/context/use-app-context";
import { useAuth } from "@/context/use-auth";
import { useTheme } from "@/context/use-theme";
import { client, formatError } from "@/lib/client";
import {
  DEMO_LOGIN_EMAIL,
  DEMO_LOGIN_PASSWORD,
  isDemoLoginHost,
} from "@/lib/demo-login";
import { SETUP_PATH } from "@/lib/navigation";
import { ditherLogoSrc } from "@/lib/theme";

function resolvePostAuthPath(
  health: { providerConfigured?: boolean } | null,
  from?: string
): string {
  if (health?.providerConfigured !== true) {
    return SETUP_PATH;
  }

  return from ?? "/chat";
}

type LoginMode = "passkey" | "password";

export function LoginPage() {
  const demoLogin = isDemoLoginHost();
  const [email, setEmail] = useState(demoLogin ? DEMO_LOGIN_EMAIL : "");
  const [password, setPassword] = useState(
    demoLogin ? DEMO_LOGIN_PASSWORD : ""
  );
  const [mfaCode, setMfaCode] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [mode, setMode] = useState<LoginMode>("passkey");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, isAuthenticated, refreshSession } = useAuth();
  const { health } = useAppContext();
  const { resolvedTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  if (isAuthenticated) {
    return <Navigate replace to={resolvePostAuthPath(health, from)} />;
  }

  if (health?.userConfigured === false) {
    return <Navigate replace to={SETUP_PATH} />;
  }

  async function handlePasskey() {
    setError(null);
    setIsSubmitting(true);
    try {
      const { challengeId, options } = await client.getPasskeyLoginOptions(
        email.trim()
      );
      const response = await startAuthentication({
        optionsJSON:
          options as unknown as PublicKeyCredentialRequestOptionsJSON,
      });
      await client.verifyPasskeyLogin(challengeId, response);
      await refreshSession();
      navigate(resolvePostAuthPath(health, from), { replace: true });
    } catch (err) {
      setError(formatError(err));
      setMode("password");
    } finally {
      setIsSubmitting(false);
    }
  }
  async function handlePassword(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password, {
        backupCode: backupCode.trim() || undefined,
        mfaCode: mfaCode.trim() || undefined,
      });
      navigate(resolvePostAuthPath(health, from), { replace: true });
    } catch (err) {
      setError(formatError(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    if (mode === "passkey") {
      event.preventDefault();
      await handlePasskey();
      return;
    }
    await handlePassword(event);
  }

  return (
    <div className="flex h-svh items-center justify-center bg-background px-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center text-center">
          <img
            alt="Nakama"
            className="mb-4 size-14 rounded-xl"
            src={ditherLogoSrc(resolvedTheme)}
          />
          <h1 className="font-semibold text-xl tracking-tight">
            Sign in to Nakama
          </h1>
          {demoLogin ? null : (
            <p className="text-muted-foreground text-sm">
              Use a passkey first, or choose another sign-in method.
            </p>
          )}
        </div>
        {demoLogin ? (
          <div className="space-y-2 rounded-md border bg-muted/40 px-3 py-3 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-muted-foreground">Email</span>
              <span className="text-right font-mono">{DEMO_LOGIN_EMAIL}</span>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-muted-foreground">Password</span>
              <span className="text-right font-mono">
                {DEMO_LOGIN_PASSWORD}
              </span>
            </div>
          </div>
        ) : null}
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block font-medium text-sm" htmlFor="email">
              Email
            </label>
            <Input
              id="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@example.com"
              required
              type="email"
              value={email}
            />
          </div>
          {mode === "password" ? (
            <>
              <div>
                <label
                  className="mb-1 block font-medium text-sm"
                  htmlFor="password"
                >
                  Password
                </label>
                <Input
                  id="password"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  required
                  type="password"
                  value={password}
                />
              </div>
              <div>
                <label
                  className="mb-1 block font-medium text-sm"
                  htmlFor="mfa-code"
                >
                  TOTP code
                </label>
                <Input
                  id="mfa-code"
                  inputMode="numeric"
                  onChange={(event) => setMfaCode(event.target.value)}
                  placeholder="Optional if MFA is off"
                  value={mfaCode}
                />
              </div>
              <div>
                <label
                  className="mb-1 block font-medium text-sm"
                  htmlFor="backup-code"
                >
                  Backup code
                </label>
                <Input
                  id="backup-code"
                  onChange={(event) => setBackupCode(event.target.value)}
                  placeholder="Use instead of TOTP"
                  value={backupCode}
                />
              </div>
            </>
          ) : null}
          {error ? (
            <div
              className="rounded-md bg-red-50 px-3 py-2 text-red-800 text-sm dark:bg-red-950/30 dark:text-red-200"
              role="alert"
            >
              {error}
            </div>
          ) : null}
          {mode === "passkey" ? (
            <Button
              className="w-full"
              disabled={isSubmitting || !email.trim()}
              onClick={() => void handlePasskey()}
              type="button"
            >
              {isSubmitting ? "Waiting for passkey…" : "Continue with passkey"}
            </Button>
          ) : (
            <Button className="w-full" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Signing in…" : "Sign in"}
            </Button>
          )}
          {mode === "passkey" ? (
            <Button
              className="w-full"
              onClick={() => {
                setMode("password");
                setError(null);
              }}
              type="button"
              variant="outline"
            >
              Use another method
            </Button>
          ) : (
            <Button
              className="w-full"
              onClick={() => {
                setMode("passkey");
                setError(null);
              }}
              type="button"
              variant="ghost"
            >
              Use passkey
            </Button>
          )}
          {mode === "password" && !demoLogin ? (
            <Link
              className="block text-center font-medium text-primary text-sm hover:underline"
              to="/reset-password"
            >
              Forgot password?
            </Link>
          ) : null}
        </form>
      </div>
    </div>
  );
}
