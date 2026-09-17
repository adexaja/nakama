import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/use-auth";
import { client } from "@/lib/client";
import { queryKeys } from "@/lib/query-keys";

function useWorkerMutation(mutationFn: (name: string) => Promise<unknown>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.systemStatus }),
        queryClient.invalidateQueries({ queryKey: ["plugin-workers"] }),
      ]);
    },
  });
}

export function useStartWorker() {
  const { activeOrg } = useAuth();
  const api = client.forOrg(activeOrg?.id ?? null);
  return useWorkerMutation((name) => api.startWorker(name));
}

export function useStopWorker() {
  const { activeOrg } = useAuth();
  const api = client.forOrg(activeOrg?.id ?? null);
  return useWorkerMutation((name) => api.stopWorker(name));
}

export function useRestartWorker() {
  const { activeOrg } = useAuth();
  const api = client.forOrg(activeOrg?.id ?? null);
  return useWorkerMutation((name) => api.restartWorker(name));
}

export function usePluginWorkers() {
  const { activeOrg } = useAuth();
  const orgId = activeOrg?.id;
  return useQuery({
    enabled: Boolean(orgId) && activeOrg?.role !== "viewer",
    queryFn: () => client.listPluginWorkers(orgId),
    queryKey: ["plugin-workers", orgId],
    refetchInterval: 5000,
  });
}
