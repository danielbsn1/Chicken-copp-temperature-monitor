import type { Prisma } from "../../generated/prisma/client.js";
import { db } from "../../core/db.js";

export type Tx = Prisma.TransactionClient;

export interface NewReading {
  deviceId: string;
  ts: Date;
  tempC: number;
  humPct: number;
  fanOn: boolean;
}

export function findLatest(deviceId: string) {
  return db.reading.findFirst({
    where: { deviceId },
    orderBy: { ts: "desc" },
    select: { ts: true, tempC: true, humPct: true, fanOn: true },
  });
}

/** Grava ignorando as linhas que já existem (chave primária); devolve quantas entraram. */
export async function createMany(rows: NewReading[], tx?: Tx): Promise<number> {
  if (rows.length === 0) return 0;
  const result = await (tx ?? db).reading.createMany({
    data: rows,
    skipDuplicates: true,
  });
  return result.count;
}
