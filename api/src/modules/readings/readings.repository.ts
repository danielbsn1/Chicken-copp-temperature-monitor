import { db } from "../../core/db.js";

export function findLatest(deviceId: string) {
  return db.reading.findFirst({
    where: { deviceId },
    orderBy: { ts: "desc" },
    select: { ts: true, tempC: true, humPct: true, fanOn: true },
  });
}
