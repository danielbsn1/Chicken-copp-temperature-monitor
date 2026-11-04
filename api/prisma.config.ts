import { defineConfig, env } from "prisma/config";

try {
  process.loadEnvFile();
} catch {
  // sem .env: as variáveis vêm do ambiente (CI, produção)
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: env("DATABASE_URL") },
});
