import { Prisma } from "../../generated/prisma/client.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { db } from "../../core/db.js";

/** Cliente da transação do Prisma, repassado por quem abre a transação (ingest). */
export type Tx = Prisma.TransactionClient;

const client = (tx?: Tx): Tx | PrismaClient => tx ?? db;

export function listKeyHashes() {
  return db.device.findMany({ select: { id: true, keyHash: true } });
}

export function findById(id: string) {
  return db.device.findUnique({ where: { id } });
}

export async function save(id: string, name: string, keyHash: string): Promise<void> {
  await db.device.upsert({
    where: { id },
    create: { id, name, keyHash },
    update: { name, keyHash },
  });
}

/** last_seen_at só avança: GREATEST ignora o NULL e descarta o valor mais antigo. */
export async function touch(id: string, seenAt: Date, tx?: Tx): Promise<void> {
  await client(tx).$executeRaw(
    Prisma.sql`UPDATE devices SET last_seen_at = GREATEST(last_seen_at, ${seenAt}) WHERE id = ${id}`,
  );
}

export async function setFirmware(id: string, fwVersion: string, tx?: Tx): Promise<void> {
  await client(tx).device.update({ where: { id }, data: { fwVersion } });
}
