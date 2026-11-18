import { db } from "../src/core/db.js";
import { createDeviceArgs } from "../src/modules/devices/devices.schemas.js";
import { registerDevice } from "../src/modules/devices/index.js";

// Uso: pnpm device:create <id> <nome>
// Cadastra o dispositivo ou troca a chave dele. A chave aparece uma única vez.
const parsed = createDeviceArgs.safeParse(process.argv.slice(2));

if (!parsed.success) {
  console.error("Uso: pnpm device:create <id> <nome>");
  console.error("O id usa minúsculas, números e hífen (até 64 caracteres).");
  process.exit(1);
}

try {
  const { id, name } = parsed.data;
  const { created, key } = await registerDevice(id, name);
  console.log(
    created
      ? `Dispositivo "${id}" cadastrado.`
      : `Chave do dispositivo "${id}" trocada; a anterior não vale mais.`,
  );
  console.log(`Chave (guarde agora, ela não será mostrada de novo): ${key}`);
} finally {
  await db.$disconnect();
}
