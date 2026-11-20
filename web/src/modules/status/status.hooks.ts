import { useQuery } from "@tanstack/react-query";
import { getStatus } from "./status.api";

/** Atualiza a cada 60 s e para com a aba oculta (refetchIntervalInBackground é false no cliente). */
export function useStatus() {
  return useQuery({
    queryKey: ["status"],
    queryFn: ({ signal }) => getStatus(signal),
    refetchInterval: 60_000,
  });
}
