import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getEvents, type EventRange } from "./events.api";

export const PAGE_SIZE = 50;
export const MAX_LIMIT = 200;

/** Mantém a lista anterior na tela enquanto o novo filtro ou limite carrega. */
export function useEvents(
  type: string | undefined,
  limit: number,
  range: EventRange = {},
  enabled = true,
) {
  return useQuery({
    queryKey: ["events", type ?? "all", limit, range.from ?? null, range.to ?? null],
    queryFn: ({ signal }) => getEvents(type, limit, range, signal),
    placeholderData: keepPreviousData,
    enabled,
  });
}
