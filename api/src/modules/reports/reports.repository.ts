import { db } from "../../core/db.js";

export interface DailyValues {
  tempMinC: number;
  tempMaxC: number;
  tempAvgC: number;
  fanOnMinutes: number;
  readingsCount: number;
}

/** Grava o resumo em (device_id, day); recalcular regrava os mesmos valores e preserva telegram_sent_at. */
export function upsert(deviceId: string, day: Date, values: DailyValues) {
  return db.dailySummary.upsert({
    where: { deviceId_day: { deviceId, day } },
    create: { deviceId, day, ...values },
    update: values,
  });
}
