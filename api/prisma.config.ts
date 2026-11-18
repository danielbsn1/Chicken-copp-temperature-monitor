import { defineConfig } from "prisma/config";

try {
  process.loadEnvFile();
} catch {
  // sem .env: as variáveis vêm do ambiente (CI, produção)
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // Sem DIRECT_URL só o `prisma generate` funciona (instalação, CI, build da Vercel);
  // as migrações exigem a variável.
  datasource: { url: process.env.DIRECT_URL ?? "" },
});
