import { db } from "../../core/db.js";

export function findUserByEmail(email: string) {
  return db.user.findUnique({ where: { email } });
}

export function findUserById(id: string) {
  return db.user.findUnique({ where: { id } });
}

/** Cadastra o usuário ou troca a senha dele. */
export async function saveUser(email: string, passwordHash: string) {
  const existing = await db.user.findUnique({ where: { email } });
  const user = await db.user.upsert({
    where: { email },
    create: { email, passwordHash },
    update: { passwordHash },
  });
  return { id: user.id, created: existing === null };
}

export function countFailures(key: string, since: Date) {
  return db.loginAttempt.count({ where: { key, at: { gt: since } } });
}

export async function addFailure(key: string, at: Date): Promise<void> {
  await db.loginAttempt.create({ data: { key, at } });
}

export async function clearFailures(key: string): Promise<void> {
  await db.loginAttempt.deleteMany({ where: { key } });
}

/** Apaga as tentativas anteriores a `before`; devolve quantas saíram. */
export async function deleteAttemptsBefore(before: Date): Promise<number> {
  const result = await db.loginAttempt.deleteMany({ where: { at: { lt: before } } });
  return result.count;
}
