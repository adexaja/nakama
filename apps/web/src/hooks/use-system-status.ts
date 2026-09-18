import type {
  DiscordWorkerStatus,
  SystemStatusResponse,
} from "@nakama/core/contract";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/use-auth";
import { client } from "@/lib/client";
import { queryKeys } from "@/lib/query-keys";

const REFRESH_INTERVAL_MS = 10_000;

const DEFAULT_DISCORD_WORKER_STATUS: DiscordWorkerStatus = {
  configured: false,
  connected: false,
  ok: true,
  paired: false,
  running: false,
};

function normalizeSystemStatus(
  status: SystemStatusResponse
): SystemStatusResponse {
  return {
    ...status,
    discordWorker: status.discordWorker ?? DEFAULT_DISCORD_WORKER_STATUS,
  };
}

export function useSystemStatusQuery() {
  const { activeOrg } = useAuth();
  const orgId = activeOrg?.id ?? null;
  const api = client.forOrg(orgId);
  return useQuery({
    queryFn: async () => normalizeSystemStatus(await api.getSystemStatus()),
    queryKey: [...queryKeys.systemStatus, orgId],
    refetchInterval: REFRESH_INTERVAL_MS,
    refetchIntervalInBackground: true,
  });
}

export function useRefreshSystemStatus() {
  const queryClient = useQueryClient();

  return () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.systemStatus });
}
