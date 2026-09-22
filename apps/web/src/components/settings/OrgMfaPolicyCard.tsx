import { Button } from "@nakama/ui/button";
import { Card, CardContent } from "@nakama/ui/card";
import { Spinner } from "@nakama/ui/spinner";
import { Switch } from "@nakama/ui/switch";
import { toast } from "@nakama/ui/toast";
import { useState } from "react";
import { useAuth } from "@/context/use-auth";
import { client, formatError } from "@/lib/client";

export function OrgMfaPolicyCard() {
  const { activeOrg, updateOrg } = useAuth();
  const [pending, setPending] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!activeOrg || activeOrg.role !== "admin") {
    return null;
  }

  async function handleMfaToggle(checked: boolean) {
    setPending(true);
    try {
      await updateOrg(activeOrg!.id, {
        mfaEnabled: checked,
        mfaRequired: checked ? activeOrg.mfaRequired : false,
      });
      toast("Organization MFA policy saved.");
    } catch (err) {
      toast(formatError(err));
    } finally {
      setPending(false);
    }
  }

  async function handleRequiredToggle(checked: boolean) {
    setPending(true);
    try {
      await updateOrg(activeOrg!.id, {
        mfaEnabled: true,
        mfaRequired: checked,
      });
      toast("Organization MFA policy saved.");
    } catch (err) {
      toast(formatError(err));
    } finally {
      setPending(false);
    }
  }

  async function generateKey() {
    setPending(true);
    setError(null);
    try {
      await client.ensureMfaEncryptionKey();
      setGenerated(true);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="w-full overflow-hidden shadow-none">
      <CardContent className="p-0">
        <div className="border-border border-b px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <p className="font-medium text-foreground text-sm">
              Organization MFA
            </p>
            <div className="flex shrink-0 items-center gap-2">
              {pending ? <Spinner /> : null}
              <Switch
                aria-label="Enable organization MFA"
                checked={activeOrg.mfaEnabled === true}
                disabled={pending}
                onCheckedChange={(checked) => void handleMfaToggle(checked)}
                size="sm"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <p className="font-medium text-foreground text-sm">
            Enforce Organization MFA
          </p>
          <Switch
            aria-label="Enforce Organization MFA"
            checked={activeOrg.mfaRequired === true}
            disabled={pending || activeOrg.mfaEnabled !== true}
            onCheckedChange={(checked) => void handleRequiredToggle(checked)}
            size="sm"
          />
        </div>
        {generated ? null : (
          <div className="flex items-center justify-between gap-4 border-border border-b px-4 py-3">
            <p className="text-muted-foreground text-sm">
              Configure the MFA encryption key for this organization.
            </p>
            <Button
              disabled={pending}
              onClick={() => void generateKey()}
              type="button"
            >
              Generate encryption key
            </Button>
          </div>
        )}
        {error ? (
          <p
            className="border-border border-b px-4 py-3 text-destructive text-sm"
            role="alert"
          >
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
