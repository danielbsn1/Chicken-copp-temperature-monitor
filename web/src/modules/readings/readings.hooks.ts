import { useQuery } from "@tanstack/react-query";
import { useActiveDeviceId } from "../../shared/device";
import { getReadings } from "./readings.api";
import type { PeriodId } from "./readings.periods";

/** Atualiza a cada 60 s e para com a aba oculta; o intervalo é recalculado a cada busca. */
export function useReadings(period: PeriodId) {
  const deviceId = useActiveDeviceId();
  return useQuery({
    queryKey: ["readings", deviceId, period],
    queryFn: ({ signal }) => getReadings(deviceId, period, signal),
    refetchInterval: 60_000,
  });
}
