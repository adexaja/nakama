import { Button } from "@nakama/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@nakama/ui/input-group";
import { Spinner } from "@nakama/ui/spinner";
import { CheckmarkCircle01Icon, ViewIcon, ViewOffIcon } from "hugeicons-react";
import type { ReactNode } from "react";
import { SettingsRow } from "@/components/discord-settings-card.shared";
import { DiscordSettingsPairingSection } from "@/components/discord-settings-pairing-section";
import {
  ChannelAccessSettings,
  IntegrationSettingsFooter,
} from "@/components/integration-settings.shared";
import { WorkerActionBar } from "@/components/WorkerActionBar";
import { useStartWorker } from "@/hooks/use-worker-actions";
import { formatError } from "@/lib/client";
import {
  DISCORD_DEVELOPER_PORTAL_URL,
  DISCORD_SETUP_GUIDE_URL,
} from "@/lib/integration-docs";

function DiscordBotTokenFields({
  configured,
  settings,
  botToken,
  onBotTokenChange,
  onToggleShowBotToken,
  savePending,
  showBotToken,
}: {
  configured: boolean;
  settings: { botTokenMasked?: string | null } | null | undefined;
  botToken: string;
  onBotTokenChange: (value: string) => void;
  onToggleShowBotToken: () => void;
  savePending: boolean;
  showBotToken: boolean;
}) {
  return (
    <SettingsRow
      className="px-4 py-3"
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
  );
}

function DiscordConnectionStep({
  running,
  managed,
  children,
}: {
  running: boolean;
  managed: boolean;
  children: ReactNode;
}) {
  const start = useStartWorker();
  return (
    <div className="space-y-4 px-4 py-3">
      <p className="text-muted-foreground text-sm">
        {running
          ? "Connecting to Discord…"
          : "Start the connection so your agent can receive messages."}
      </p>
      {running ? (
        <Spinner aria-label="Connecting to Discord" />
      ) : (
        <Button
          disabled={start.isPending || !managed}
          onClick={() => start.mutate("discord")}
          size="sm"
        >
          {start.isPending ? "Starting…" : "Start connection"}
        </Button>
      )}
      {start.error ? (
        <p className="text-destructive text-sm" role="alert">
          {formatError(start.error)}
        </p>
      ) : null}
      <details>
        <summary className="cursor-pointer text-muted-foreground text-sm">
          Having trouble?
        </summary>
        <div className="space-y-4 pt-3">{children}</div>
      </details>
    </div>
  );
}

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

function DiscordSetupChecklist({
  step,
  children,
}: {
  step: number;
  children: ReactNode;
}) {
  return (
    <ol
      aria-label="Discord setup progress"
      className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card"
    >
      {["Add bot", "Start connection", "Link account"].map((label, index) => (
        <li aria-current={index === step ? "step" : undefined} key={label}>
          <div className="flex items-center gap-3 px-4 py-4">
            {index < step ? (
              <CheckmarkCircle01Icon
                aria-hidden
                className="size-5 shrink-0 text-emerald-600"
              />
            ) : (
              <span
                aria-hidden
                className="flex size-5 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground text-xs"
              >
                {index + 1}
              </span>
            )}
            <h2 className="font-medium text-sm">{label}</h2>
            {index < step ? <span className="sr-only">Complete</span> : null}
          </div>
          {index === step ? (
            <div aria-label={label} className="pb-2" role="region">
              {children}
            </div>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function discordSetupStep(
  configured: boolean,
  running: boolean,
  connected: boolean,
  hasLinkedUsers: boolean
) {
  if (!configured) {
    return 0;
  }
  if (!(running && connected)) {
    return 1;
  }
  return hasLinkedUsers ? 3 : 2;
}

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
  worker:
    | { connected?: boolean; process?: { managed?: boolean } }
    | null
    | undefined;
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

  const step = discordSetupStep(
    configured,
    running,
    worker?.connected === true,
    hasLinkedUsers
  );
  const tokenEditor = (
    <DiscordBotTokenFields
      botToken={botToken}
      configured={configured}
      onBotTokenChange={onBotTokenChange}
      onToggleShowBotToken={onToggleShowBotToken}
      savePending={savePending}
      settings={settings}
      showBotToken={showBotToken}
    />
  );
  const workerActions = (
    <WorkerActionBar
      compact
      pm2Managed={worker?.process?.managed ?? false}
      running={running}
      workerName="discord"
    />
  );
  const pairing = (
    <DiscordSettingsPairingSection
      compact
      copied={copied}
      guided={step === 2}
      inviteUrl={settings?.inviteUrl ?? null}
      isPaired={isPaired}
      onCopyHandshakeCode={onCopyHandshakeCode}
      onRegenerateHandshake={onRegenerateHandshake}
      pairingCode={pairingCode}
      regeneratePending={regeneratePending}
      rowClassName={paneItemClass}
      savePending={savePending}
    />
  );
  const footer = (
    <IntegrationSettingsFooter
      canSave={canSave}
      className={paneItemClass}
      formError={formError}
      loadError={loadError}
      onSave={onSave}
      savePending={savePending}
      showSave={canSave || savePending || !configured}
      statusLine={statusLine}
      submitLabel={configured ? submitLabel : "Continue"}
    />
  );

  const checklist = (
    <DiscordSetupChecklist step={step}>
      {step === 0 ? tokenEditor : null}
      {step === 1 ? (
        <DiscordConnectionStep
          managed={worker?.process?.managed === true}
          running={running}
        >
          {workerActions}
          {tokenEditor}
        </DiscordConnectionStep>
      ) : null}
      {step === 2 ? <div className="px-4 pb-3">{pairing}</div> : null}
      {footer}
    </DiscordSetupChecklist>
  );
  if (step < 3) {
    return checklist;
  }

  return (
    <div className="space-y-4">
      {checklist}
      <ChannelAccessSettings
        actions={workerActions}
        configured={configured}
        onEdit={onManageAllowedUsers}
        pending={savePending}
        statusBadge={statusBadge}
        summary={allowedUserSummary}
      />
      <details className="group overflow-hidden rounded-xl border border-border bg-card">
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
        <div className="divide-y divide-border border-border border-t">
          {tokenEditor}

          {pairing}
        </div>
      </details>

      {footer}
    </div>
  );
}
