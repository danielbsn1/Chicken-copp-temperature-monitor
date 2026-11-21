import { db } from "../src/core/db.js";
import { createDeviceArgs } from "../src/modules/devices/devices.schemas.js";
import { registerDevice } from "../src/modules/devices/index.js";

// Uso: pnpm device:create <id> <nome> [--owner <email>]
// Cadastra o dispositivo ou troca a chave dele. A chave aparece uma única vez.
// --owner define o usuário dono (precisa existir); sem ele o dono atual continua.
const args = process.argv.slice(2);
const flag = args.indexOf("--owner");
const ownerEmail = flag >= 0 ? args[flag + 1]?.trim().toLowerCase() : undefined;
const rest = flag >= 0 ? args.filter((_, i) => i !== flag && i !== flag + 1) : args;
const parsed = createDeviceArgs.safeParse(rest);

if (!parsed.success || (flag >= 0 && !ownerEmail)) {
  console.error("Uso: pnpm device:create <id> <nome> [--owner <email>]");
  console.error("O id usa minúsculas, números e hífen (até 64 caracteres).");
  process.exit(1);
}

try {
  const { id, name } = parsed.data;
  let ownerId: string | undefined;
  if (ownerEmail) {
    const owner = await db.user.findUnique({ where: { email: ownerEmail } });
    if (!owner) {
      console.error(`Usuário ${ownerEmail} não existe. Crie antes com pnpm user:create.`);
      process.exit(1);
    }
    ownerId = owner.id;
  }
  const { created, key } = await registerDevice(id, name, ownerId);
  console.log(
    created
      ? `Dispositivo "${id}" cadastrado.`
      : `Chave do dispositivo "${id}" trocada; a anterior não vale mais.`,
  );
  console.log(`Chave (guarde agora, ela não será mostrada de novo): ${key}`);
} finally {
  await db.$disconnect();
}
