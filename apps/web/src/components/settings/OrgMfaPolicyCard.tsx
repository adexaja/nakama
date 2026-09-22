import { Switch } from "@nakama/ui/switch";
import { useState } from "react";
import { useAuth } from "@/context/use-auth";
import { formatError } from "@/lib/client";

export function OrgMfaPolicyCard() {
  const { activeOrg, updateOrg } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!activeOrg || activeOrg.role !== "admin") {
    return null;
  }
  const org = activeOrg;

  async function update(input: {
    mfaEnabled?: boolean;
    mfaRequired?: boolean;
  }) {
    setPending(true);
    setError(null);
    try {
      await updateOrg(org.id, input);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-lg border bg-card p-4 shadow-none">
      <div className="space-y-1">
        <h2 className="font-semibold text-base">Organization MFA policy</h2>
        <p className="text-muted-foreground text-sm">
          Require organization members to enroll a passkey or authenticator.
        </p>
      </div>
      {error ? (
        <p className="mt-3 text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mt-4 divide-y divide-border rounded-md border">
        <div className="flex items-center justify-between gap-3 px-3 py-3">
          <div>
            <p className="font-medium text-sm">Enable MFA</p>
            <p className="text-muted-foreground text-xs">
              Allow members to use MFA on this organization.
            </p>
          </div>
          <Switch
            aria-label="Enable organization MFA"
            checked={org.mfaEnabled === true}
            disabled={pending}
            onCheckedChange={(checked) => void update({ mfaEnabled: checked })}
          />
        </div>
        <div className="flex items-center justify-between gap-3 px-3 py-3">
          <div>
            <p className="font-medium text-sm">Require MFA</p>
            <p className="text-muted-foreground text-xs">
              Redirect members without MFA to account settings.
            </p>
          </div>
          <Switch
            aria-label="Require organization MFA"
            checked={org.mfaRequired === true}
            disabled={pending || org.mfaEnabled !== true}
            onCheckedChange={(checked) =>
              void update({
                mfaEnabled: checked ? true : org.mfaEnabled,
                mfaRequired: checked,
              })
            }
          />
        </div>
      </div>
    </section>
  );
}
