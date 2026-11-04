import type { Db } from "../lib/prisma.js";

export type ReadingRow = {
  ts: Date;
  tempC: number;
  humPct: number;
  fanOn: boolean;
};

export async function insertReadings(
  db: Db,
  deviceId: string,
  rows: ReadingRow[],
): Promise<number> {
  const { count } = await db.reading.createMany({
    data: rows.map((r) => ({ deviceId, ...r })),
    skipDuplicates: true,
  });
  return count;
}
