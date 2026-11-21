import { env } from "../../config/env";
import { http } from "../../shared/api/http";
import { eventsSchema, type EventsResponse } from "./events.schemas";

/** Intervalo em UTC (ISO 8601): `from` entra e `to` não entra. */
export interface EventRange {
  from?: string;
  to?: string;
}

/** Do mais novo para o mais antigo; `type` e o intervalo são opcionais e `limit` vai até 200. */
export function getEvents(
  type: string | undefined,
  limit: number,
  range: EventRange,
  signal?: AbortSignal,
): Promise<EventsResponse> {
  return http(
    "/events",
    {
      query: { deviceId: env.deviceId, type, limit, from: range.from, to: range.to },
      signal,
    },
    eventsSchema,
  );
}
