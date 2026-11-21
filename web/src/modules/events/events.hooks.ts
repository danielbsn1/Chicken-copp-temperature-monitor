import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useActiveDeviceId } from "../../shared/device";
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
  const deviceId = useActiveDeviceId();
  return useQuery({
    queryKey: [
      "events",
      deviceId,
      type ?? "all",
      limit,
      range.from ?? null,
      range.to ?? null,
    ],
    queryFn: ({ signal }) => getEvents(deviceId, type, limit, range, signal),
    placeholderData: keepPreviousData,
    enabled,
  });
}
