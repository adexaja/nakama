import { Button } from "@nakama/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@nakama/ui/card";
import { useState } from "react";
import { useAuth } from "@/context/use-auth";
import { client, formatError } from "@/lib/client";

export function MfaEncryptionKeyCard() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (user?.isPlatformAdmin !== true) {
    return null;
  }

  async function generateKey() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await client.ensureMfaEncryptionKey();
      setMessage("MFA encryption key is configured.");
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="w-full shadow-none">
      <CardHeader>
        <CardTitle className="text-base">MFA encryption key</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-muted-foreground text-sm">
          Generate the key used to encrypt organization MFA secrets in config
          file.
        </p>
        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="text-emerald-700 text-sm" role="status">
            {message}
          </p>
        ) : null}
        <Button
          disabled={busy}
          onClick={() => void generateKey()}
          type="button"
        >
          Generate encryption key
        </Button>
      </CardContent>
    </Card>
  );
}
