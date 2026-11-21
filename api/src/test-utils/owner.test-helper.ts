import { db } from "../core/db.js";
import { signSession } from "../core/session.js";

/** Usuário de teste (cria se não existir) e o cookie de sessão dele. */
export async function testUser(email: string) {
  const user = await db.user.upsert({
    where: { email },
    create: { email, passwordHash: "x" },
    update: {},
  });
  return { id: user.id, cookie: `session=${signSession(user.id)}` };
}

export async function removeTestUser(email: string) {
  await db.user.deleteMany({ where: { email } });
}
