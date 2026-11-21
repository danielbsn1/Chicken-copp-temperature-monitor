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

/** Resumos ainda não enviados ao Telegram, a partir de `since`, do mais antigo ao mais novo. */
export function findUnsent(since: Date) {
  return db.dailySummary.findMany({
    where: { telegramSentAt: null, day: { gte: since } },
    orderBy: [{ day: "asc" }, { deviceId: "asc" }],
  });
}

export async function markSent(deviceId: string, day: Date, at: Date): Promise<void> {
  await db.dailySummary.update({
    where: { deviceId_day: { deviceId, day } },
    data: { telegramSentAt: at },
  });
}
