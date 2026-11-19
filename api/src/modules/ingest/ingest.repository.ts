import type { Prisma } from "../../generated/prisma/client.js";
import { db } from "../../core/db.js";

export type Tx = Prisma.TransactionClient;

/** Abre uma transação: se `fn` lançar, nada do que ela gravou fica. */
export function runInTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.$transaction(fn);
}
