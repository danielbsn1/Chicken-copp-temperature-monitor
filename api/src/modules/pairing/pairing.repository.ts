import type { Prisma } from "../../generated/prisma/client.js";
import { db } from "../../core/db.js";

export type Tx = Prisma.TransactionClient;

export function runInTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.$transaction(fn);
}

export function find(serial: string) {
  return db.pairingAnnouncement.findUnique({ where: { serial } });
}

export interface AnnouncementRow {
  serial: string;
  keyHash: string;
  fwVersion: string;
  ip: string;
  announcedAt: Date;
  pairingUntil: Date | null;
}

/** Grava o anúncio; um novo anúncio com chave diferente (equipamento zerado) volta a esperar dono. */
export async function upsert(row: AnnouncementRow): Promise<void> {
  await db.pairingAnnouncement.upsert({
    where: { serial: row.serial },
    create: row,
    update: { ...row, claimedDeviceId: null },
  });
}

/** Só renova o horário e o IP de um anúncio já vinculado (o equipamento continua o mesmo). */
export async function touchClaimed(serial: string, ip: string, at: Date): Promise<void> {
  await db.pairingAnnouncement.update({
    where: { serial },
    data: { ip, announcedAt: at },
  });
}

/** Anúncios sem dono, com a janela de pareamento aberta e no mesmo IP. */
export function listOpenByIp(ip: string, now: Date) {
  return db.pairingAnnouncement.findMany({
    where: { ip, claimedDeviceId: null, pairingUntil: { gt: now } },
    orderBy: { announcedAt: "desc" },
    select: { serial: true, fwVersion: true, pairingUntil: true },
  });
}

/** Marca como vinculado só se ainda não estava (duas pessoas não levam o mesmo equipamento). */
export async function markClaimed(
  serial: string,
  deviceId: string,
  tx: Tx,
): Promise<boolean> {
  const result = await tx.pairingAnnouncement.updateMany({
    where: { serial, claimedDeviceId: null },
    data: { claimedDeviceId: deviceId, pairingUntil: null },
  });
  return result.count === 1;
}

/** Limpeza do job diário: apaga os anúncios anteriores a `before`. */
export async function deleteBefore(before: Date): Promise<number> {
  const result = await db.pairingAnnouncement.deleteMany({
    where: { announcedAt: { lt: before } },
  });
  return result.count;
}
