import { generateKey, hashKey } from "../src/lib/device-key.js";
import { prisma } from "../src/lib/prisma.js";

const [id, name] = process.argv.slice(2);
if (!id || !name) {
  console.error('Uso: pnpm device:create <id> "<nome>"');
  process.exit(1);
}

const key = generateKey();
await prisma().device.upsert({
  where: { id },
  create: { id, name, keyHash: hashKey(key) },
  update: { name, keyHash: hashKey(key) },
});
await prisma().$disconnect();

console.log(`Dispositivo: ${id}`);
console.log("Chave (guarde agora, não será mostrada de novo):");
console.log(key);
