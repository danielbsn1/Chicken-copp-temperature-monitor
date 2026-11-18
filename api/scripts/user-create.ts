import { randomBytes, scrypt } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { promisify } from "node:util";
import { db } from "../src/core/db.js";

// Uso: pnpm user:create <email>
// A senha é pedida no terminal (não vai para o histórico do shell).
const email = process.argv[2]?.trim().toLowerCase();

if (!email) {
  console.error("Uso: pnpm user:create <email>");
  process.exit(1);
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
const password = await rl.question("Senha: ");
rl.close();

if (password.length < 12) {
  console.error("A senha precisa ter pelo menos 12 caracteres.");
  process.exit(1);
}

const salt = randomBytes(16);
const hash = (await promisify(scrypt)(password, salt, 64)) as Buffer;
const passwordHash = `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;

await db.user.upsert({
  where: { email },
  create: { email, passwordHash },
  update: { passwordHash },
});
await db.$disconnect();

console.log(`Usuário ${email} cadastrado.`);
