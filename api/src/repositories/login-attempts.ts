import type { Db } from "../lib/prisma.js";

export function recordFailedAttempt(db: Db, key: string) {
  return db.loginAttempt.create({ data: { key } });
}

export function countFailedAttempts(db: Db, key: string, since: Date) {
  return db.loginAttempt.count({ where: { key, at: { gte: since } } });
}

export function clearAttempts(db: Db, key: string) {
  return db.loginAttempt.deleteMany({ where: { key } });
}
