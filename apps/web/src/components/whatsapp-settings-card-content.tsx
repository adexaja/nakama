import { Button } from "@nakama/ui/button";
import { Card, CardContent } from "@nakama/ui/card";
import { Switch } from "@nakama/ui/switch";
import { cn } from "@nakama/ui/utils";
import {
  IntegrationSettingsFooter,
  IntegrationStatusHeader,
  SettingsRow,
} from "@/components/integration-settings.shared";
import { WorkerActionBar } from "@/components/WorkerActionBar";
import { WhatsAppSettingsLinkingSection } from "@/components/whatsapp-settings-linking-section";

export function WhatsAppSettingsCardContent({
  embedded,
  statusBadge,
  configured,
  paired,
  running,
  showQr,
  linkedNumber,
  savePending,
  pairingCode,
  copied,
  onCopyPairingCode,
  onRegeneratePairingCode,
  regeneratePending,
  qrCode,
  linkingAfterScan,
  bridgeStarting,
  awaitingQr,
  showReconnect,
  onReconnect,
  reconnectPending,
  worker,
  statusLine,
  formError,
  loadError,
  canSave,
  actionLabel,
  allowedPhoneSummary,
  onManageAllowedPhones,
  requireGroupMention,
  onRequireGroupMentionChange,
  onSave,
}: {
  embedded: boolean;
  headerSubtitle: string;
  statusBadge: string;
  configured: boolean;
  paired: boolean;
  running: boolean;
  showQr: boolean;
  linkedNumber: string | null;
  savePending: boolean;
  pairingCode: string | null;
  copied: boolean;
  onCopyPairingCode: () => void;
  onRegeneratePairingCode: () => void;
  regeneratePending: boolean;
  qrCode: string | null;
  linkingAfterScan: boolean;
  bridgeStarting: boolean;
  awaitingQr: boolean;
  showReconnect: boolean;
  onReconnect: () => void;
  reconnectPending: boolean;
  worker: { process?: { managed?: boolean } } | null | undefined;
  statusLine: string | null;
  formError: string | null;
  loadError: unknown;
  canSave: boolean;
  actionLabel: string;
  allowedPhoneSummary: string;
  onManageAllowedPhones: () => void;
  requireGroupMention: boolean;
  onRequireGroupMentionChange: (value: boolean) => void;
  onSave: () => void;
}) {
  const paneItemClass = "px-4 py-3";
  const hasError = Boolean(formError || loadError);
  const feedbackClass = hasError ? "text-destructive" : "text-muted-foreground";
  const feedbackRole = hasError ? "alert" : "status";

  return (
    <div className="space-y-4">
      <Card className="w-full overflow-hidden shadow-none">
        <CardContent className="divide-y divide-border p-0">
          <IntegrationStatusHeader
            actions={
              configured ? (
                <WorkerActionBar
                  compact
                  pm2Managed={worker?.process?.managed ?? false}
                  running={running}
                  workerName="whatsapp"
                />
              ) : null
            }
            className={paneItemClass}
            configured={configured}
            connected={statusBadge === "Connected"}
            statusBadge={statusBadge}
            title="Connection"
          />

          {linkedNumber ? (
            <SettingsRow className={paneItemClass} label="Connected number">
              <span className="text-foreground text-sm">{linkedNumber}</span>
            </SettingsRow>
          ) : null}

          {configured ? (
            <>
              <SettingsRow label="Only reply when mentioned in groups">
                <Switch
                  aria-label="Only reply when mentioned in groups"
                  checked={requireGroupMention}
                  disabled={savePending}
                  id="whatsapp-require-group-mention"
                  onCheckedChange={onRequireGroupMentionChange}
                />
              </SettingsRow>
              <SettingsRow label="Who can message this agent?">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <span className="text-muted-foreground text-xs">
                    {allowedPhoneSummary}
                  </span>
                  <Button
                    disabled={savePending}
                    onClick={onManageAllowedPhones}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Edit
                  </Button>
                </div>
              </SettingsRow>
            </>
          ) : null}
        </CardContent>
      </Card>

      {configured ? (
        <details
          className="group overflow-hidden rounded-xl border border-border bg-card"
          key={String(paired)}
          open={!paired}
        >
          <summary className="cursor-pointer list-none px-4 py-3 font-medium text-sm outline-none marker:hidden focus-visible:ring-2 focus-visible:ring-ring">
            <span className="flex items-center justify-between gap-3">
              Settings
              <span className="text-muted-foreground text-xs group-open:hidden">
                Show
              </span>
              <span className="hidden text-muted-foreground text-xs group-open:inline">
                Hide
              </span>
            </span>
          </summary>

          <WhatsAppSettingsLinkingSection
            awaitingQr={awaitingQr}
            bridgeStarting={bridgeStarting}
            compact={!embedded}
            copied={copied}
            linkingAfterScan={linkingAfterScan}
            onCopyPairingCode={onCopyPairingCode}
            onReconnect={onReconnect}
            onRegeneratePairingCode={onRegeneratePairingCode}
            paired={paired}
            pairingCode={pairingCode}
            qrCode={qrCode}
            reconnectPending={reconnectPending}
            regeneratePending={regeneratePending}
            rowClassName={paneItemClass}
            savePending={savePending}
            showQr={showQr}
            showReconnect={showReconnect}
          />
        </details>
      ) : null}

      {canSave || savePending ? (
        <IntegrationSettingsFooter
          canSave={canSave}
          className={paneItemClass}
          formError={formError}
          loadError={loadError}
          onSave={onSave}
          savePending={savePending}
          statusLine={statusLine}
          submitLabel={actionLabel}
        />
      ) : (
        <div className="flex items-center justify-between gap-3 py-3">
          <p className={cn("text-xs", feedbackClass)} role={feedbackRole}>
            {statusLine}
          </p>
        </div>
      )}
    </div>
  );
}
