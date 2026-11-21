import { useQuery } from "@tanstack/react-query";
import { useActiveDeviceId } from "../../shared/device";
import { getStatus } from "./status.api";

/** Atualiza a cada 60 s e para com a aba oculta (refetchIntervalInBackground é false no cliente). */
export function useStatus() {
  const deviceId = useActiveDeviceId();
  return useQuery({
    queryKey: ["status", deviceId],
    queryFn: ({ signal }) => getStatus(deviceId, signal),
    refetchInterval: 60_000,
  });
}
