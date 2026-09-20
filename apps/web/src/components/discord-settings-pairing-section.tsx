import { Button } from "@nakama/ui/button";
import { Spinner } from "@nakama/ui/spinner";
import {
  CheckmarkCircle01Icon,
  Copy01Icon,
  RefreshIcon,
} from "hugeicons-react";
import {
  DiscordPairingGuide,
  SettingsRow,
} from "@/components/discord-settings-card.shared";

function pairingCodeDescription(
  pairingCode: string | null,
  isPaired: boolean
): string {
  if (pairingCode) {
    if (isPaired) {
      return "Send this code to your bot in Discord to link another account.";
    }

    return "Send this code to your bot in Discord to finish linking.";
  }

  if (isPaired) {
    return "Discord is linked. Generate a new code to link another account.";
  }

  return "Generate a code, then message it to your bot once.";
}

function DiscordPairingCodeControls({
  copied,
  isPaired,
  onCopyHandshakeCode,
  onRegenerateHandshake,
  pairingCode,
  regeneratePending,
  savePending,
}: {
  copied: boolean;
  isPaired: boolean;
  onCopyHandshakeCode: () => void;
  onRegenerateHandshake: () => void;
  pairingCode: string | null;
  regeneratePending: boolean;
  savePending: boolean;
}) {
  if (pairingCode) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <code className="rounded-md border border-border bg-background px-2.5 py-1 text-sm tracking-widest">
          {pairingCode}
        </code>
        <Button
          className="min-w-[5.25rem] justify-center"
          onClick={onCopyHandshakeCode}
          size="sm"
          type="button"
          variant="outline"
        >
          {copied ? (
            <CheckmarkCircle01Icon
              aria-hidden
              className="size-3.5 text-emerald-600 dark:text-emerald-400"
            />
          ) : (
            <Copy01Icon aria-hidden className="size-3.5" />
          )}
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button
          disabled={regeneratePending || savePending}
          onClick={onRegenerateHandshake}
          size="sm"
          type="button"
          variant="outline"
        >
          {regeneratePending ? (
            <Spinner />
          ) : (
            <>
              <RefreshIcon aria-hidden="true" className="size-3.5" />
              New code
            </>
          )}
        </Button>
      </div>
    );
  }

  if (isPaired) {
    return (
      <Button
        disabled={regeneratePending || savePending}
        onClick={onRegenerateHandshake}
        size="sm"
        type="button"
        variant="outline"
      >
        {regeneratePending ? (
          <Spinner />
        ) : (
          <>
            <RefreshIcon aria-hidden="true" className="size-3.5" />
            New code
          </>
        )}
      </Button>
    );
  }

  return (
    <Button
      disabled={regeneratePending || savePending}
      onClick={onRegenerateHandshake}
      size="sm"
      type="button"
    >
      {regeneratePending ? (
        <>
          <Spinner className="size-3" />
          Generating…
        </>
      ) : (
        "Generate pairing code"
      )}
    </Button>
  );
}

export function DiscordSettingsPairingSection({
  isPaired,
  pairingCode,
  copied,
  savePending,
  regeneratePending,
  inviteUrl,
  onCopyHandshakeCode,
  onRegenerateHandshake,
  rowClassName,
  compact = false,
}: {
  isPaired: boolean;
  pairingCode: string | null;
  copied: boolean;
  savePending: boolean;
  regeneratePending: boolean;
  inviteUrl: string | null;
  onCopyHandshakeCode: () => void;
  onRegenerateHandshake: () => void;
  rowClassName?: string;
  compact?: boolean;
}) {
  return (
    <div className="divide-y divide-border">
      <SettingsRow
        className={rowClassName}
        description={pairingCodeDescription(pairingCode, isPaired)}
        label="Link with a code"
      >
        <DiscordPairingCodeControls
          copied={copied}
          isPaired={isPaired}
          onCopyHandshakeCode={onCopyHandshakeCode}
          onRegenerateHandshake={onRegenerateHandshake}
          pairingCode={pairingCode}
          regeneratePending={regeneratePending}
          savePending={savePending}
        />
      </SettingsRow>

      {pairingCode ? (
        <DiscordPairingGuide compact={compact} inviteUrl={inviteUrl} />
      ) : null}
    </div>
  );
}
