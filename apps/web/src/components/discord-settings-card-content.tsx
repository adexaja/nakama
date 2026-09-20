import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@nakama/ui/input-group";
import { ViewIcon, ViewOffIcon } from "hugeicons-react";
import { SettingsRow } from "@/components/discord-settings-card.shared";
import { DiscordSettingsPairingSection } from "@/components/discord-settings-pairing-section";
import {
  ChannelAccessSettings,
  IntegrationSettingsFooter,
} from "@/components/integration-settings.shared";
import { WorkerActionBar } from "@/components/WorkerActionBar";
import {
  DISCORD_DEVELOPER_PORTAL_URL,
  DISCORD_SETUP_GUIDE_URL,
} from "@/lib/integration-docs";

export type DiscordSettingsCardView = {
  embedded: boolean;
  configured: boolean;
  hasLinkedUsers: boolean;
  running: boolean;
  showBotToken: boolean;
  savePending: boolean;
  isPaired: boolean;
  copied: boolean;
  regeneratePending: boolean;
  canSave: boolean;
};

export function DiscordSettingsCardContent({
  view,
  statusBadge,
  settings,
  botToken,
  onBotTokenChange,
  onToggleShowBotToken,
  pairingCode,
  onCopyHandshakeCode,
  onRegenerateHandshake,
  allowedUserSummary,
  onManageAllowedUsers,
  worker,
  statusLine,
  formError,
  loadError,
  submitLabel,
  onSave,
}: {
  view: DiscordSettingsCardView;
  statusBadge: string;
  settings:
    | {
        botTokenMasked?: string | null;
        inviteUrl?: string | null;
      }
    | null
    | undefined;
  botToken: string;
  onBotTokenChange: (value: string) => void;
  onToggleShowBotToken: () => void;
  pairingCode: string | null;
  onCopyHandshakeCode: () => void;
  onRegenerateHandshake: () => void;
  allowedUserSummary: string;
  onManageAllowedUsers: () => void;
  worker: { process?: { managed?: boolean } } | null | undefined;
  statusLine: string | null;
  formError: string | null;
  loadError: unknown;
  submitLabel: string;
  onSave: () => void;
}) {
  const {
    configured,
    hasLinkedUsers,
    running,
    showBotToken,
    savePending,
    isPaired,
    copied,
    regeneratePending,
    canSave,
  } = view;

  const paneItemClass = "px-4 py-3";

  return (
    <div className="space-y-4">
      <ChannelAccessSettings
        configured={configured}
        onEdit={onManageAllowedUsers}
        pending={savePending}
        statusBadge={statusBadge}
        summary={allowedUserSummary}
      />
      <details
        className="group overflow-hidden rounded-xl border border-border bg-card"
        key={String(hasLinkedUsers)}
        open={!hasLinkedUsers}
      >
        <summary className="cursor-pointer list-none px-4 py-3 font-medium text-sm outline-none marker:hidden focus-visible:ring-2 focus-visible:ring-ring">
          <span className="flex items-center justify-between gap-3">
            Connection options
            <span className="text-muted-foreground text-xs group-open:hidden">
              Show
            </span>
            <span className="hidden text-muted-foreground text-xs group-open:inline">
              Hide
            </span>
          </span>
        </summary>
        <div className="divide-y divide-border border-border border-t">
          {configured ? (
            <SettingsRow
              description={running ? "Active" : "Stopped"}
              label="Discord connection"
            >
              <WorkerActionBar
                compact
                pm2Managed={worker?.process?.managed ?? false}
                running={running}
                workerName="discord"
              />
            </SettingsRow>
          ) : null}

          <SettingsRow
            className={paneItemClass}
            description={
              <>
                Create a bot in the{" "}
                <a
                  className="font-medium text-primary underline-offset-2 hover:underline"
                  href={DISCORD_DEVELOPER_PORTAL_URL}
                  rel="noreferrer"
                  target="_blank"
                >
                  Discord Developer Portal
                </a>
                . Follow the{" "}
                <a
                  className="font-medium text-primary underline-offset-2 hover:underline"
                  href={DISCORD_SETUP_GUIDE_URL}
                  rel="noreferrer"
                  target="_blank"
                >
                  setup guide
                </a>{" "}
                for token, intents, and invite steps.
              </>
            }
            label="Bot token"
            layout="stacked"
          >
            <InputGroup className="w-full">
              <InputGroupInput
                aria-label="Bot token"
                autoComplete="off"
                disabled={savePending}
                id="discord-bot-token"
                onChange={(event) => onBotTokenChange(event.target.value)}
                placeholder={
                  configured && settings?.botTokenMasked
                    ? `Saved (${settings.botTokenMasked})`
                    : "Paste token"
                }
                type={showBotToken ? "text" : "password"}
                value={botToken}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  aria-label={showBotToken ? "Hide token" : "Show token"}
                  onClick={onToggleShowBotToken}
                  size="icon-xs"
                  type="button"
                >
                  {showBotToken ? (
                    <ViewOffIcon className="size-4" />
                  ) : (
                    <ViewIcon className="size-4" />
                  )}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </SettingsRow>

          {configured ? (
            <DiscordSettingsPairingSection
              compact
              copied={copied}
              inviteUrl={settings?.inviteUrl ?? null}
              isPaired={isPaired}
              onCopyHandshakeCode={onCopyHandshakeCode}
              onRegenerateHandshake={onRegenerateHandshake}
              pairingCode={pairingCode}
              regeneratePending={regeneratePending}
              rowClassName={paneItemClass}
              savePending={savePending}
            />
          ) : null}
        </div>
      </details>

      <IntegrationSettingsFooter
        canSave={canSave}
        className={paneItemClass}
        formError={formError}
        loadError={loadError}
        onSave={onSave}
        savePending={savePending}
        showSave={canSave || savePending || !configured}
        statusLine={statusLine}
        submitLabel={submitLabel}
      />
    </div>
  );
}
