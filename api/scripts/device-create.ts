import { createHash, randomBytes } from "node:crypto";
import { db } from "../src/core/db.js";

// Uso: pnpm device:create <id> <nome>
// Cadastra o dispositivo ou troca a chave dele. A chave aparece uma única vez.
const [id, ...nameParts] = process.argv.slice(2);
const name = nameParts.join(" ");

if (!id || !name) {
  console.error("Uso: pnpm device:create <id> <nome>");
  process.exit(1);
}

const key = randomBytes(32).toString("hex");
const keyHash = createHash("sha256").update(key).digest("hex");

await db.device.upsert({
  where: { id },
  create: { id, name, keyHash },
  update: { name, keyHash },
});
await db.$disconnect();

console.log(`Dispositivo "${id}" cadastrado.`);
console.log(`Chave (guarde agora, ela não será mostrada de novo): ${key}`);
