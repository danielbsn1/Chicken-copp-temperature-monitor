import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getEvents } from "./events.api";

export const PAGE_SIZE = 50;
export const MAX_LIMIT = 200;

/** Mantém a lista anterior na tela enquanto o novo filtro ou limite carrega. */
export function useEvents(type: string | undefined, limit: number) {
  return useQuery({
    queryKey: ["events", type ?? "all", limit],
    queryFn: ({ signal }) => getEvents(type, limit, signal),
    placeholderData: keepPreviousData,
  });
}
