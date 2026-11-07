import type { Db } from "../lib/prisma.js";

export function findUserByEmail(db: Db, email: string) {
  return db.user.findUnique({ where: { email } });
}

export function findUserById(db: Db, id: string) {
  return db.user.findUnique({ where: { id } });
}
