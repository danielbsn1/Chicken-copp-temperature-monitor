import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getDailySummary } from "./reports.api";

/** Um resumo por dia; um dia já gravado não muda, então o cache vale por mais tempo. */
export function useDailyReport(day: string) {
  return useQuery({
    queryKey: ["reports", "daily", day],
    queryFn: ({ signal }) => getDailySummary(day, signal),
    enabled: day !== "",
    placeholderData: keepPreviousData,
  });
}
