import type { Db } from "../lib/prisma.js";

export function findDevice(db: Db, id: string) {
  return db.device.findUnique({ where: { id } });
}

export function touchDevice(db: Db, id: string, fwVersion?: string) {
  return db.device.update({
    where: { id },
    data: { lastSeenAt: new Date(), ...(fwVersion ? { fwVersion } : {}) },
  });
}
