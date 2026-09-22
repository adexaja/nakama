import { Card, CardContent, CardHeader, CardTitle } from "@nakama/ui/card";
import { Switch } from "@nakama/ui/switch";
import { useState } from "react";
import { useAuth } from "@/context/use-auth";
import { formatError } from "@/lib/client";

export function OrgMfaPolicyCard() {
  const { activeOrg, updateOrg } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!activeOrg) {
    return null;
  }

  async function update(input: {
    mfaEnabled?: boolean;
    mfaRequired?: boolean;
  }) {
    setPending(true);
    setError(null);
    try {
      if (!activeOrg?.id) {
        return;
      }
      await updateOrg(activeOrg.id, input);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="w-full shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Organization MFA policy</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-3">
          <p className="font-medium text-sm">Enable MFA</p>
          <Switch
            aria-label="Enable organization MFA"
            checked={activeOrg.mfaEnabled === true}
            disabled={pending}
            onCheckedChange={(checked) => void update({ mfaEnabled: checked })}
          />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-3">
          <p className="font-medium text-sm">Enforce MFA</p>
          <Switch
            aria-label="Enforce organization MFA"
            checked={activeOrg.mfaRequired === true}
            disabled={pending || activeOrg.mfaEnabled !== true}
            onCheckedChange={(checked) =>
              void update({
                mfaEnabled: checked ? true : activeOrg.mfaEnabled,
                mfaRequired: checked,
              })
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}
