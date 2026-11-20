import { useQuery } from "@tanstack/react-query";
import { getReadings } from "./readings.api";
import type { PeriodId } from "./readings.periods";

/** Atualiza a cada 60 s e para com a aba oculta; o intervalo é recalculado a cada busca. */
export function useReadings(period: PeriodId) {
  return useQuery({
    queryKey: ["readings", period],
    queryFn: ({ signal }) => getReadings(period, signal),
    refetchInterval: 60_000,
  });
}
