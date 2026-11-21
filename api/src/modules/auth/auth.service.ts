import { randomBytes } from "node:crypto";
import { RateLimitError, UnauthorizedError, ValidationError } from "../../core/errors.js";
import * as repository from "./auth.repository.js";
import { registerInput, type AuthUser } from "./auth.schemas.js";
import { hashPassword, verifyPassword } from "./password.js";

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;

// Hash de uma senha aleatória: dá o mesmo trabalho de conferência para e-mails
// que não existem, assim o tempo da resposta não revela quais e-mails existem.
let fakeHash: Promise<string> | undefined;
const getFakeHash = () => (fakeHash ??= hashPassword(randomBytes(16).toString("hex")));

const normalize = (email: string) => email.trim().toLowerCase();

/**
 * Confere e-mail e senha. Depois de 5 falhas em 15 min para o mesmo e-mail,
 * responde 429 (mesmo com a senha certa) até as falhas saírem da janela.
 */
export async function login(
  email: string,
  password: string,
  now = new Date(),
): Promise<AuthUser> {
  const key = normalize(email);

  const failures = await repository.countFailures(
    key,
    new Date(now.getTime() - WINDOW_MS),
  );
  if (failures >= MAX_FAILURES)
    throw new RateLimitError("Muitas tentativas. Tente mais tarde.");

  const user = await repository.findUserByEmail(key);
  const valid = await verifyPassword(
    password,
    user?.passwordHash ?? (await getFakeHash()),
  );
  if (!user || !valid) {
    await repository.addFailure(key, now);
    throw new UnauthorizedError("E-mail ou senha inválidos");
  }

  await repository.clearFailures(key);
  return { id: user.id, email: user.email };
}

/** Dono da sessão. Usuário que não existe mais perde a sessão (401). */
export async function getUser(id: string): Promise<AuthUser> {
  const user = await repository.findUserById(id);
  if (!user) throw new UnauthorizedError();
  return { id: user.id, email: user.email };
}

/** Cadastra o usuário ou troca a senha; usado só pelo `pnpm user:create` (não há rota). */
export async function registerUser(email: string, password: string) {
  const parsed = registerInput.safeParse({ email, password });
  if (!parsed.success) {
    throw new ValidationError(
      "Entrada inválida",
      parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    );
  }
  const passwordHash = await hashPassword(parsed.data.password);
  const { created } = await repository.saveUser(parsed.data.email, passwordHash);
  return { created, email: parsed.data.email };
}

/** Limpeza do job diário: apaga as tentativas de login anteriores a `before`. */
export function purgeLoginAttempts(before: Date): Promise<number> {
  return repository.deleteAttemptsBefore(before);
}
