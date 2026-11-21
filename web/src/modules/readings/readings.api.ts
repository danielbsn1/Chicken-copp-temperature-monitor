import { http } from "../../shared/api/http";
import { periodById, type PeriodId } from "./readings.periods";
import { seriesSchema, type Series } from "./readings.schemas";

/** Série do período terminando agora; from e to saem em ISO UTC. */
export function getReadings(
  deviceId: string,
  period: PeriodId,
  signal?: AbortSignal,
  now = Date.now(),
): Promise<Series> {
  const { durationMs, bucket } = periodById(period);
  return http(
    "/readings",
    {
      query: {
        deviceId,
        from: new Date(now - durationMs).toISOString(),
        to: new Date(now).toISOString(),
        bucket,
      },
      signal,
    },
    seriesSchema,
  );
}
