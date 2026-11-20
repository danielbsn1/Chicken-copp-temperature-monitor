import { Prisma } from "../../generated/prisma/client.js";
import { db } from "../../core/db.js";

export type Tx = Prisma.TransactionClient;

export interface NewEvent {
  deviceId: string;
  ts: Date;
  type: string;
  detail?: Prisma.InputJsonValue;
}

export interface EventFilter {
  deviceId: string;
  from?: Date;
  to?: Date;
  type?: string;
  limit: number;
}

/** Grava ignorando as linhas que já existem (chave primária); devolve quantas entraram. */
export async function createMany(rows: NewEvent[], tx?: Tx): Promise<number> {
  if (rows.length === 0) return 0;
  const result = await (tx ?? db).event.createMany({ data: rows, skipDuplicates: true });
  return result.count;
}

/** Do mais novo para o mais antigo, pela chave primária (device_id, ts, type). */
export function findMany({ deviceId, from, to, type, limit }: EventFilter) {
  return db.event.findMany({
    where: {
      deviceId,
      ...(type ? { type } : {}),
      ...(from || to
        ? { ts: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } }
        : {}),
    },
    orderBy: [{ ts: "desc" }, { type: "desc" }],
    take: limit,
    select: { ts: true, type: true, detail: true },
  });
}
