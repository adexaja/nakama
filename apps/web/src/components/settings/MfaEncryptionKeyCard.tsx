import { Button } from "@nakama/ui/button";
import { Card } from "@nakama/ui/card";
import { Spinner } from "@nakama/ui/spinner";
import { useState } from "react";
import { useAuth } from "@/context/use-auth";
import { client, formatError } from "@/lib/client";

export function MfaEncryptionKeyCard() {
  const { activeOrg } = useAuth();
  const [busy, setBusy] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!activeOrg || activeOrg.role !== "admin" || generated) {
    return null;
  }

  async function generateKey() {
    setBusy(true);
    setError(null);
    try {
      await client.ensureMfaEncryptionKey();
      setGenerated(true);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="w-full overflow-hidden shadow-none">
      <div className="border-border border-b px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <p className="font-medium text-foreground text-sm">
            MFA encryption key
          </p>
          {busy ? <Spinner /> : null}
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <p className="text-muted-foreground text-sm">
          Generate the key used to encrypt organization MFA secrets.
        </p>
        <Button
          disabled={busy}
          onClick={() => void generateKey()}
          type="button"
        >
          Generate encryption key
        </Button>
      </div>
      {error ? (
        <p
          className="border-border border-t px-4 py-3 text-destructive text-sm"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </Card>
  );
}
