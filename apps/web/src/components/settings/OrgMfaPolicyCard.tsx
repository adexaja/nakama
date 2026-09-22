import { Card, CardContent } from "@nakama/ui/card";
import { Spinner } from "@nakama/ui/spinner";
import { Switch } from "@nakama/ui/switch";
import { toast } from "@nakama/ui/toast";
import { useState } from "react";
import { useAuth } from "@/context/use-auth";
import { formatError } from "@/lib/client";

export function OrgMfaPolicyCard() {
  const { activeOrg, updateOrg } = useAuth();
  const [pending, setPending] = useState(false);

  if (!activeOrg) {
    return null;
  }

  async function update(input: {
    mfaEnabled?: boolean;
    mfaRequired?: boolean;
  }) {
    setPending(true);
    try {
      await updateOrg(activeOrg!.id, input);
      toast("Organization MFA policy saved.");
    } catch (err) {
      toast(formatError(err));
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
                onCheckedChange={(checked) =>
                  void update({
                    mfaEnabled: checked,
                    mfaRequired: checked ? activeOrg.mfaRequired : false,
                  })
                }
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
            onCheckedChange={(checked) =>
              void update({
                mfaEnabled: checked ? true : activeOrg.mfaEnabled,
                mfaRequired: checked,
              })
            }
            size="sm"
          />
        </div>
      </CardContent>
    </Card>
  );
}
