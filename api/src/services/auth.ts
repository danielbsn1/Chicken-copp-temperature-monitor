import { hashPassword, verifyPassword } from "../lib/password.js";
import { prisma } from "../lib/prisma.js";
import {
  clearAttempts,
  countFailedAttempts,
  recordFailedAttempt,
} from "../repositories/login-attempts.js";
import { findUserByEmail } from "../repositories/users.js";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

// Hash de uma senha qualquer: quando o e-mail não existe, ainda gastamos o
// mesmo tempo de uma verificação real, para não revelar quais e-mails existem.
const dummyHash = hashPassword("senha-que-ninguem-usa");

export type LoginResult =
  | { status: "ok"; userId: string }
  | { status: "invalid" }
  | { status: "locked" };

export async function login(
  email: string,
  password: string,
): Promise<LoginResult> {
  const db = prisma();
  const key = email.toLowerCase();

  const since = new Date(Date.now() - WINDOW_MS);
  if ((await countFailedAttempts(db, key, since)) >= MAX_ATTEMPTS) {
    return { status: "locked" };
  }

  const user = await findUserByEmail(db, key);
  const valid = await verifyPassword(
    password,
    user?.passwordHash ?? (await dummyHash),
  );

  if (!user || !valid) {
    await recordFailedAttempt(db, key);
    return { status: "invalid" };
  }

  await clearAttempts(db, key);
  return { status: "ok", userId: user.id };
}
