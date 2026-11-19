import { Prisma } from "../../generated/prisma/client.js";
import { db } from "../../core/db.js";

export type Tx = Prisma.TransactionClient;

export interface NewEvent {
  deviceId: string;
  ts: Date;
  type: string;
  detail?: Prisma.InputJsonValue;
}

/** Grava ignorando as linhas que já existem (chave primária); devolve quantas entraram. */
export async function createMany(rows: NewEvent[], tx?: Tx): Promise<number> {
  if (rows.length === 0) return 0;
  const result = await (tx ?? db).event.createMany({ data: rows, skipDuplicates: true });
  return result.count;
}
