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

export async function save(
  id: string,
  name: string,
  keyHash: string,
  ownerId?: string,
): Promise<void> {
  await db.device.upsert({
    where: { id },
    create: { id, name, keyHash, ownerId },
    // Trocar a chave não tira o dono; só muda se um dono novo for informado.
    update: { name, keyHash, ...(ownerId ? { ownerId } : {}) },
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

export function listAll() {
  return db.device.findMany({ select: { id: true, name: true }, orderBy: { id: "asc" } });
}

/** Equipamentos de um dono, do mais antigo cadastro (por id) ao mais novo. */
export function listByOwner(ownerId: string) {
  return db.device.findMany({
    where: { ownerId },
    select: { id: true, name: true, lastSeenAt: true, fwVersion: true },
    orderBy: { id: "asc" },
  });
}

export async function isOwnedBy(deviceId: string, ownerId: string): Promise<boolean> {
  const count = await db.device.count({ where: { id: deviceId, ownerId } });
  return count > 0;
}

export function existsById(id: string, tx?: Tx) {
  return client(tx).device.count({ where: { id } });
}

/** Cria o equipamento já com dono e com a chave que o próprio equipamento gerou. */
export async function createOwned(
  row: { id: string; name: string; keyHash: string; ownerId: string },
  tx?: Tx,
): Promise<void> {
  await client(tx).device.create({ data: row });
}
