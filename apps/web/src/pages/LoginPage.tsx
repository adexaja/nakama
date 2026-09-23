import { NakamaApiError } from "@nakama/core/api-error";
import { Button } from "@nakama/ui/button";
import { Input } from "@nakama/ui/input";
import { ArrowLeft02Icon } from "hugeicons-react";
import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { MfaCodeInput } from "@/components/MfaCodeInput";
import { useAppContext } from "@/context/use-app-context";
import { useAuth } from "@/context/use-auth";
import { useTheme } from "@/context/use-theme";
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

export function LoginPage() {
  const demoLogin = isDemoLoginHost();
  const [email, setEmail] = useState(demoLogin ? DEMO_LOGIN_EMAIL : "");
  const [password, setPassword] = useState(
    demoLogin ? DEMO_LOGIN_PASSWORD : ""
  );
  const [mfaCode, setMfaCode] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, isAuthenticated } = useAuth();
  const { health } = useAppContext();
  const { resolvedTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  if (isAuthenticated && !isSubmitting) {
    return <Navigate replace to={resolvePostAuthPath(health, from)} />;
  }

  if (health?.userConfigured === false) {
    return <Navigate replace to={SETUP_PATH} />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await login(email, password, {
        backupCode: useBackupCode ? backupCode.trim() || undefined : undefined,
        mfaCode: useBackupCode ? undefined : mfaCode.trim() || undefined,
      });
      if (response.mfaRequired && !response.mfaEnrolled) {
        navigate("/settings?mfa=required", { replace: true });
      } else {
        navigate(resolvePostAuthPath(health, from), { replace: true });
      }
    } catch (err) {
      if (
        err instanceof NakamaApiError &&
        err.message === "MFA verification required."
      ) {
        setMfaRequired(true);
      }
      const message = err instanceof Error ? err.message : "Login failed";
      setError(
        message === "MFA verification required."
          ? "Authentication code required."
          : message
      );
    } finally {
      setIsSubmitting(false);
    }
  };

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
            {mfaRequired ? "Verify your identity" : "Sign in to Nakama"}
          </h1>
          {mfaRequired || demoLogin ? null : (
            <p className="text-muted-foreground text-sm">
              Enter your credentials to access your account.
            </p>
          )}
          {demoLogin && !mfaRequired ? (
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
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          {mfaRequired ? null : (
            <>
              <div>
                <label
                  className="mb-1 block font-medium text-sm"
                  htmlFor="email"
                >
                  Email
                </label>
                <Input
                  id="email"
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  required
                  type="email"
                  value={email}
                />
              </div>
              <div>
                <label
                  className="mb-1 block font-medium text-sm"
                  htmlFor="password"
                >
                  Password
                </label>
                <Input
                  id="password"
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  type="password"
                  value={password}
                />
              </div>
            </>
          )}
          {mfaRequired ? (
            <div className="space-y-3 p-0">
              <div className="relative flex items-center">
                <Button
                  aria-label="Back to sign in"
                  className="absolute -left-8"
                  onClick={() => {
                    setMfaRequired(false);
                    setUseBackupCode(false);
                    setMfaCode("");
                    setBackupCode("");
                    setError(null);
                  }}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <ArrowLeft02Icon aria-hidden className="size-4" />
                </Button>
                <label className="font-medium text-sm" htmlFor="login-email">
                  Email
                </label>
              </div>
              <p className="text-muted-foreground text-sm" id="login-email">
                {email}
              </p>
              {useBackupCode ? (
                <div>
                  <label
                    className="mb-1 block font-medium text-sm"
                    htmlFor="login-backup-code"
                  >
                    Backup code
                  </label>
                  <Input
                    id="login-backup-code"
                    onChange={(event) => setBackupCode(event.target.value)}
                    placeholder="Enter a backup code"
                    value={backupCode}
                  />
                </div>
              ) : (
                <div>
                  <label className="mb-1 block font-medium text-sm">
                    Authentication code
                  </label>
                  <MfaCodeInput
                    id="login-mfa-code"
                    onChange={setMfaCode}
                    value={mfaCode}
                  />
                </div>
              )}
              <Button
                onClick={() => {
                  setUseBackupCode((current) => !current);
                  setMfaCode("");
                  setBackupCode("");
                }}
                type="button"
                variant="link"
              >
                {useBackupCode
                  ? "Use authenticator code instead"
                  : "Use a backup code instead"}
              </Button>
            </div>
          ) : null}
          {error && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-red-800 text-sm dark:bg-red-950/30 dark:text-red-200">
              {error}
            </div>
          )}
          <Button className="w-full" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Verifying..." : mfaRequired ? "Verify" : "Sign in"}
          </Button>
          {mfaRequired || demoLogin ? null : (
            <Link
              className="block text-center font-medium text-primary text-sm hover:underline"
              to="/reset-password"
            >
              Forgot password?
            </Link>
          )}
        </form>
      </div>
    </div>
  );
}
