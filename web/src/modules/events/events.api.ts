import { env } from "../../config/env";
import { http } from "../../shared/api/http";
import { eventsSchema, type EventsResponse } from "./events.schemas";

/** Do mais novo para o mais antigo; `type` é opcional e `limit` vai até 200. */
export function getEvents(
  type: string | undefined,
  limit: number,
  signal?: AbortSignal,
): Promise<EventsResponse> {
  return http(
    "/events",
    { query: { deviceId: env.deviceId, type, limit }, signal },
    eventsSchema,
  );
}
