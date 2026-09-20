import type { ProfileSummary } from "@nakama/core";
import { Button } from "@nakama/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@nakama/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@nakama/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@nakama/ui/select";
import { toast } from "@nakama/ui/toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown01Icon,
  Building06Icon,
  CloudDownloadIcon,
  Copy01Icon,
  Delete02Icon,
  MoreHorizontalIcon,
} from "hugeicons-react";
import { useState } from "react";
import { DiscordSettingsCard } from "@/components/DiscordSettingsCard";
import { ExportProfileButton } from "@/components/profiles/ExportProfileButton";
import { ProfileSkillsSettingsSection } from "@/components/profiles/ProfileSkillsSettingsSection";
import { SoulTab } from "@/components/soul-tools/SoulTab";
import { TelegramSettingsCard } from "@/components/TelegramSettingsCard";
import { WhatsAppSettingsCard } from "@/components/WhatsAppSettingsCard";
import { useAuth } from "@/context/use-auth";
import { ChannelProfileContext } from "@/hooks/use-app-queries";
import { useSystemStatusQuery } from "@/hooks/use-system-status";
import { client, formatError } from "@/lib/client";
import { queryKeys } from "@/lib/query-keys";
import { ProfileConfigAssignmentsSection } from "@/pages/profiles/profile-config-assignments-section";
import { ProfileConfigIdentitySection } from "@/pages/profiles/profile-config-identity-section";
import { ProfileHistoryTab } from "@/pages/profiles/profile-history-tab";
import type { ProfilesPageState } from "@/pages/profiles/use-profiles-page";

export function ProfileConfigTab({ state }: { state: ProfilesPageState }) {
  const { user, activeOrg } = useAuth();

  if (!state.detail) {
    return null;
  }

  const canCreateProfile = user?.isPlatformAdmin === true;
  const canPack = activeOrg?.role === "admin" || canCreateProfile;
  const { busy, detail, selectedId } = state;

  return (
    <div
      className="mx-auto max-w-3xl space-y-8"
      id="profile-detail-panel-profile"
    >
      {canPack && !detail.isSuper ? (
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            aria-label="Import profile"
            disabled={busy}
            onClick={() => state.setImportOpen(true)}
            size="sm"
            type="button"
            variant="outline"
          >
            <CloudDownloadIcon aria-hidden className="size-3.5" />
            <span>Import</span>
          </Button>
          <ExportProfileButton
            disabled={busy}
            profileId={detail.id}
            profileName={detail.name}
          />
          {canCreateProfile && selectedId ? (
            <ProfileAdminMenu key={selectedId} state={state} />
          ) : null}
        </div>
      ) : null}
      <ProfileConfigIdentitySection state={state} />
      {canPack ? (
        <ChannelProfileContext.Provider
          key={`${activeOrg?.id}:${detail.id}`}
          value={detail.id}
        >
          <ProfileConnections />
        </ChannelProfileContext.Provider>
      ) : null}
      {canPack ? (
        <section className="space-y-4" id="profile-prompt">
          {canCreateProfile ? <SoulTab profileId={detail.id} /> : null}
          <details className="group/history">
            <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 text-muted-foreground/55 text-sm hover:text-muted-foreground [&::-webkit-details-marker]:hidden">
              <span>Change histories</span>
              <ArrowDown01Icon
                aria-hidden="true"
                className="size-3.5 -rotate-90 transition-transform group-open/history:rotate-0"
              />
            </summary>
            <div className="pt-3">
              <ProfileHistoryTab profileId={detail.id} />
            </div>
          </details>
        </section>
      ) : null}
      <ProfileSkillsSettingsSection disabled={busy} profile={detail} />
      <ProfileConfigAssignmentsSection key={detail.id} state={state} />
    </div>
  );
}

export function ProfileConnections() {
  const { data: status, isPending, error } = useSystemStatusQuery();
  // Brand SVGs: Simple Icons v16 (CC0), https://simpleicons.org.
  const channels = [
    {
      id: "telegram",
      name: "Telegram",
      settings: TelegramSettingsCard,
      worker: status?.telegramWorker,
    },
    {
      id: "whatsapp",
      name: "WhatsApp",
      settings: WhatsAppSettingsCard,
      worker: status?.whatsappWorker,
    },
    {
      id: "discord",
      name: "Discord",
      settings: DiscordSettingsCard,
      worker: status?.discordWorker,
    },
  ].map((channel) => ({
    ...channel,
    connected: Boolean(
      !error &&
        channel.worker?.running &&
        channel.worker.paired &&
        ("connected" in channel.worker ? channel.worker.connected : true)
    ),
  }));

  return (
    <section className="space-y-2" id="profile-connections">
      <h2 className="font-medium text-sm">Connections</h2>
      {isPending ? (
        <p className="text-muted-foreground text-sm" role="status">
          Loading connections…
        </p>
      ) : null}
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          Connection status is unavailable. Open an app to check its setup.
        </p>
      ) : null}
      <div className="divide-y divide-border rounded-xl border border-border bg-card">
        {channels.map(({ id, name, connected, settings: Settings }) => (
          <Dialog key={id}>
            <DialogTrigger
              render={
                <button
                  aria-label={`${connected ? "Manage" : "Connect"} ${name}`}
                  className="flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-1.5 text-left outline-none transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                  type="button"
                />
              }
            >
              <span className="flex flex-wrap items-center gap-2">
                <img
                  alt=""
                  className="size-5 shrink-0"
                  height={20}
                  src={`/icons/${id}.svg`}
                  width={20}
                />
                <span className="font-medium text-sm">{name}</span>
                {connected ? (
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-700 text-xs dark:text-emerald-300">
                    Connected
                  </span>
                ) : null}
              </span>
              <span className="inline-flex h-7 shrink-0 items-center rounded-lg border border-border bg-background px-2 font-medium text-[0.8rem]">
                {connected ? "Manage" : "Connect"}
              </span>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {connected ? name : `Connect ${name}`}
                </DialogTitle>
              </DialogHeader>
              <Settings embedded />
            </DialogContent>
          </Dialog>
        ))}
      </div>
    </section>
  );
}

function ProfileAdminMenu({ state }: { state: ProfilesPageState }) {
  const [moveOpen, setMoveOpen] = useState(false);
  const { busy, detail, selectedId } = state;
  const deleteDisabled =
    busy || (detail?.isDefault === true && state.profiles.length < 3);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label="More profile actions"
              disabled={busy}
              size="icon-sm"
              type="button"
              variant="outline"
            />
          }
        >
          <MoreHorizontalIcon aria-hidden className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          <DropdownMenuItem
            className="cursor-pointer"
            disabled={busy}
            onClick={() => setMoveOpen(true)}
          >
            <Building06Icon aria-hidden />
            Change organization
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer"
            disabled={busy}
            onClick={() => {
              if (selectedId) {
                state.openCloneDialog(selectedId);
              }
            }}
          >
            <Copy01Icon aria-hidden />
            Clone agent
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer"
            disabled={deleteDisabled}
            onClick={() => {
              if (selectedId) {
                state.openDeleteDialog(selectedId);
              }
            }}
            variant="destructive"
          >
            <Delete02Icon aria-hidden />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <MoveProfileDialog
        onOpenChange={setMoveOpen}
        open={moveOpen}
        state={state}
      />
    </>
  );
}

function MoveProfileDialog({
  onOpenChange,
  open,
  state,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  state: ProfilesPageState;
}) {
  const { activeOrg } = useAuth();
  const [organizationId, setOrganizationId] = useState("");
  const queryClient = useQueryClient();
  const organizations = useQuery({
    enabled: open,
    queryFn: () => client.listPlatformOrganizations(),
    queryKey: ["platformOrganizations"],
  });
  const move = useMutation({
    mutationFn: async () => {
      const profileId = state.detail!.id;
      if (!(await state.flushSave())) {
        throw new Error("Save profile changes before changing organization.");
      }
      return client.moveProfile(profileId, { organizationId });
    },
    onError: (error) => toast(formatError(error)),
    onSuccess: async ({ profile }) => {
      const profileId = profile.id;
      queryClient.setQueryData<ProfileSummary[]>(
        queryKeys.profiles.all,
        (data) => data?.filter((profile) => profile.id !== profileId)
      );
      queryClient.removeQueries({
        queryKey: queryKeys.profiles.detail(profileId),
      });
      state.setSelectedId(null);
      onOpenChange(false);
      toast("Organization changed.");
      await queryClient.invalidateQueries();
    },
  });
  const destinations =
    organizations.data?.organizations.filter(
      (org) => org.id !== activeOrg?.id && !org.archivedAt
    ) ?? [];
  return (
    <Dialog
      onOpenChange={(next) => {
        if (!move.isPending) {
          onOpenChange(next);
        }
      }}
      open={open}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Select organization for: {state.detail?.name}
          </DialogTitle>
        </DialogHeader>
        <Select
          disabled={move.isPending || organizations.isPending}
          onValueChange={(value) => setOrganizationId(value ?? "")}
          value={organizationId}
        >
          <SelectTrigger
            aria-label="Destination organization"
            className="w-full"
          >
            <SelectValue placeholder="Choose organization">
              {destinations.find((org) => org.id === organizationId)?.name}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {destinations.map((org) => (
              <SelectItem key={org.id} value={org.id}>
                {org.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {organizations.isError ? (
          <p className="text-destructive text-sm" role="alert">
            {formatError(organizations.error)}
          </p>
        ) : null}
        {!(organizations.isPending || organizations.isError) &&
        destinations.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No other organizations available.
          </p>
        ) : null}
        <DialogFooter>
          <Button
            disabled={move.isPending}
            onClick={() => onOpenChange(false)}
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            disabled={
              move.isPending ||
              !destinations.some((org) => org.id === organizationId)
            }
            onClick={() => move.mutate()}
          >
            {move.isPending ? "Changing…" : "Change organization"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
