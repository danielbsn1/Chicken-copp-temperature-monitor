import { Writable } from "node:stream";
import { createInterface } from "node:readline/promises";
import { db } from "../src/core/db.js";
import { AppError } from "../src/core/errors.js";
import { registerUser } from "../src/modules/auth/index.js";

// Uso: pnpm user:create <email>
// A senha é pedida no terminal, sem aparecer na tela e fora do histórico do shell.
// Se o e-mail já existe, a senha dele é trocada.
const email = process.argv[2];

if (!email) {
  console.error("Uso: pnpm user:create <email>");
  process.exit(1);
}

let muted = false;
const output = new Writable({
  write(chunk, encoding, callback) {
    if (!muted) process.stdout.write(chunk, encoding);
    callback();
  },
});
const rl = createInterface({
  input: process.stdin,
  output,
  terminal: process.stdin.isTTY,
});
const asking = rl.question("Senha (mínimo 12 caracteres): ");
muted = true;
const password = await asking;
muted = false;
rl.close();
process.stdout.write("\n");

try {
  const result = await registerUser(email, password);
  console.log(
    result.created
      ? `Usuário ${result.email} cadastrado.`
      : `Senha do usuário ${result.email} trocada.`,
  );
} catch (err) {
  if (err instanceof AppError) {
    console.error(`${err.message}: ${JSON.stringify(err.details ?? [])}`);
    process.exitCode = 1;
  } else {
    throw err;
  }
} finally {
  await db.$disconnect();
}
