import { z } from "zod";

// Variáveis VITE_* vão para o código do navegador e são públicas: nenhum segredo entra aqui.
const envSchema = z.object({
  VITE_API_URL: z.url(),
});

export interface Env {
  apiUrl: string;
}

export class EnvError extends Error {
  constructor(readonly issues: string[]) {
    super(`Configuração inválida: ${issues.join("; ")}`);
    this.name = "EnvError";
  }
}

/** Valida as variáveis. A mensagem cita só os nomes, nunca os valores. */
export function parseEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    throw new EnvError(
      result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    );
  }
  return {
    apiUrl: result.data.VITE_API_URL.replace(/\/+$/, ""),
  };
}

let cached: Env | undefined;

function current(): Env {
  cached ??= parseEnv(import.meta.env);
  return cached;
}

/** Devolve os problemas de configuração, ou null quando está tudo certo. */
export function checkEnv(): string[] | null {
  try {
    current();
    return null;
  } catch (err) {
    if (err instanceof EnvError) return err.issues;
    throw err;
  }
}

export const env = {
  get apiUrl() {
    return current().apiUrl;
  },
};
