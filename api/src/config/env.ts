import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  DATABASE_URL: z.url(),
  DIRECT_URL: z.url(),
  SESSION_SECRET: z.string().min(32),
  CRON_SECRET: z.string().min(16),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_CHAT_ID: z.string().min(1),
  HC_PING_URL: z.url(),
  WEB_ORIGIN: z.url(),
});

export type Env = z.infer<typeof envSchema>;

/** Valida as variáveis de ambiente. Lança um erro que lista só os nomes, nunca os valores. */
export function loadEnv(source: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Variáveis de ambiente inválidas ou ausentes: ${problems}`);
  }
  return result.data;
}

export const env = loadEnv(process.env);
