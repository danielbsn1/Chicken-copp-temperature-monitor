import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useActiveDeviceId } from "../../shared/device";
import { getDailySummary } from "./reports.api";

/** Um resumo por dia; um dia já gravado não muda, então o cache vale por mais tempo. */
export function useDailyReport(day: string) {
  const deviceId = useActiveDeviceId();
  return useQuery({
    queryKey: ["reports", "daily", deviceId, day],
    queryFn: ({ signal }) => getDailySummary(deviceId, day, signal),
    enabled: day !== "",
    placeholderData: keepPreviousData,
  });
}
