import { Button } from "@nakama/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@nakama/ui/card";
import { Input } from "@nakama/ui/input";
import type { PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/browser";
import { startRegistration } from "@simplewebauthn/browser";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { useAuth } from "@/context/use-auth";
import { client, formatError } from "@/lib/client";

export function MfaSettingsCard() {
  const { user, refreshSession } = useAuth();
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showRegenerate, setShowRegenerate] = useState(false);

  async function startTotp() {
    setBusy(true);
    setError(null);
    try {
      const result = await client.startTotp();
      setTotpUri(result.uri);
      setBackupCodes([]);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  }

  async function verifyTotp() {
    setBusy(true);
    setError(null);
    try {
      const result = await client.verifyTotp(code.trim());
      setBackupCodes(result.backupCodes);
      setTotpUri(null);
      setCode("");
      await refreshSession();
      setNotice(
        "Authenticator enabled. Save these backup codes now; they are shown only once."
      );
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  }

  async function disableMfa() {
    setBusy(true);
    setError(null);
    try {
      await client.disableMfa();
      setBackupCodes([]);
      await refreshSession();
      setNotice("Authenticator disabled.");
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  }

  async function regenerateBackupCodes() {
    setBusy(true);
    setError(null);
    try {
      const result = await client.regenerateBackupCodes(code.trim());
      setBackupCodes(result.backupCodes);
      setCode("");
      setShowRegenerate(false);
      setNotice(
        "Backup codes regenerated. Save them now; they are shown only once."
      );
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  }

  async function enrollPasskey() {
    setBusy(true);
    setError(null);
    try {
      const { challengeId, options } =
        await client.getPasskeyRegistrationOptions();
      const response = await startRegistration({
        optionsJSON:
          options as unknown as PublicKeyCredentialCreationOptionsJSON,
      });
      await client.verifyPasskeyRegistration(challengeId, response);
      await refreshSession();
      setNotice("Passkey enrolled.");
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="w-full shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Multi-factor authentication</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">
          Protect this account with an authenticator app or a passkey.
        </p>
        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p
            className="text-emerald-700 text-sm dark:text-emerald-300"
            role="status"
          >
            {notice}
          </p>
        ) : null}
        {backupCodes.length > 0 ? (
          <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950/30">
            <p className="font-medium text-sm">Backup codes</p>
            <p className="text-muted-foreground text-xs">
              Each code works once. Copy or download them before leaving this
              page.
            </p>
            <code className="grid grid-cols-2 gap-1 font-mono text-sm sm:grid-cols-5">
              {backupCodes.map((backupCode) => (
                <span key={backupCode}>{backupCode}</span>
              ))}
            </code>
          </div>
        ) : null}
        {totpUri ? (
          <div className="space-y-3 rounded-md border p-3">
            <QRCodeSVG
              aria-label="Authenticator QR code"
              size={192}
              value={totpUri}
            />
            <p className="break-all font-mono text-muted-foreground text-xs">
              {totpUri}
            </p>
            <label className="block font-medium text-sm" htmlFor="mfa-code">
              Enter the 6-digit code
            </label>
            <Input
              id="mfa-code"
              inputMode="numeric"
              onChange={(event) => setCode(event.target.value)}
              value={code}
            />
            <Button
              disabled={busy || code.trim().length < 6}
              onClick={() => void verifyTotp()}
              type="button"
            >
              Verify and enable
            </Button>
          </div>
        ) : null}
        {showRegenerate ? (
          <div className="space-y-2 rounded-md border p-3">
            <label className="block font-medium text-sm" htmlFor="backup-code">
              Authenticator code
            </label>
            <Input
              id="backup-code"
              inputMode="numeric"
              onChange={(event) => setCode(event.target.value)}
              value={code}
            />
            <Button
              disabled={busy || code.trim().length < 6}
              onClick={() => void regenerateBackupCodes()}
              type="button"
            >
              Regenerate backup codes
            </Button>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {user?.mfaEnabled ? (
            <>
              <Button
                disabled={busy}
                onClick={() => void disableMfa()}
                type="button"
                variant="outline"
              >
                Disable authenticator
              </Button>
              <Button
                disabled={busy}
                onClick={() => setShowRegenerate((value) => !value)}
                type="button"
                variant="outline"
              >
                {showRegenerate ? "Cancel" : "Regenerate backup codes"}
              </Button>
            </>
          ) : (
            <Button
              disabled={busy || Boolean(totpUri)}
              onClick={() => void startTotp()}
              type="button"
            >
              Set up authenticator
            </Button>
          )}
          <Button
            disabled={busy}
            onClick={() => void enrollPasskey()}
            type="button"
            variant="outline"
          >
            Enroll passkey
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
