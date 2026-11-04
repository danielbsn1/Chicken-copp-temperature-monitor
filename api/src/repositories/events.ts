import type { Prisma } from "../generated/prisma/client.js";
import type { Db } from "../lib/prisma.js";

export type EventRow = {
  ts: Date;
  type: string;
  detail?: Record<string, unknown>;
};

export async function insertEvents(
  db: Db,
  deviceId: string,
  rows: EventRow[],
): Promise<number> {
  const { count } = await db.event.createMany({
    data: rows.map((r) => ({
      deviceId,
      ts: r.ts,
      type: r.type,
      detail: r.detail as Prisma.InputJsonObject | undefined,
    })),
    skipDuplicates: true,
  });
  return count;
}
