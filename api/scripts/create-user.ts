import { hashPassword } from "../src/lib/password.js";
import { prisma } from "../src/lib/prisma.js";

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error("Uso: pnpm user:create <email> <senha>");
  process.exit(1);
}
if (password.length < 8) {
  console.error("A senha precisa ter pelo menos 8 caracteres.");
  process.exit(1);
}

const passwordHash = await hashPassword(password);
const key = email.toLowerCase();
await prisma().user.upsert({
  where: { email: key },
  create: { email: key, passwordHash },
  update: { passwordHash },
});
await prisma().$disconnect();

console.log(`Usuário salvo: ${key}`);
