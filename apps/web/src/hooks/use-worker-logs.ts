import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/use-auth";
import { client } from "@/lib/client";
import { queryKeys } from "@/lib/query-keys";

export function useWorkerLogs(
  workerName: string,
  lines = 500,
  enabled = false
) {
  const { activeOrg } = useAuth();
  const orgId = activeOrg?.id ?? null;
  const api = client.forOrg(orgId);
  return useQuery({
    enabled,
    queryFn: () => api.getWorkerLogs(workerName, lines),
    queryKey: [...queryKeys.workerLogs, workerName, orgId, lines],
  });
}

export function useClearWorkerLogs(workerName: string) {
  const { activeOrg } = useAuth();
  const orgId = activeOrg?.id ?? null;
  const api = client.forOrg(orgId);
  const queryKey = [...queryKeys.workerLogs, workerName, orgId];
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.clearWorkerLogs(workerName),
    onMutate: () => queryKey,
    onSuccess: (_data, _variables, submittedQueryKey) => {
      queryClient.setQueriesData(
        { queryKey: submittedQueryKey },
        {
          stderr: "",
          stdout: "",
        }
      );
      void queryClient.invalidateQueries({
        queryKey: submittedQueryKey,
      });
    },
  });
}
