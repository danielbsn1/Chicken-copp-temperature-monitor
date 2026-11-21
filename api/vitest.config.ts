import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    // Os testes de contrato dividem o mesmo Postgres e o job diário varre todos os dispositivos.
    fileParallelism: false,
    env: {
      NODE_ENV: "test",
      DATABASE_URL:
        process.env.DATABASE_URL ?? "postgres://chicken:chicken@localhost:5433/chicken",
      DIRECT_URL:
        process.env.DIRECT_URL ?? "postgres://chicken:chicken@localhost:5433/chicken",
      SESSION_SECRET: "segredo-de-teste-com-mais-de-32-caracteres",
      CRON_SECRET: "segredo-do-cron-so-para-teste",
      TELEGRAM_BOT_TOKEN: "123456:token-de-teste",
      TELEGRAM_CHAT_ID: "-1000000000000",
      HC_PING_URL: "https://hc-ping.test/00000000-0000-0000-0000-000000000000",
      WEB_ORIGIN: "http://localhost:5173",
    },
    coverage: {
      provider: "v8",
      include: ["src/**/*.service.ts"],
      thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 },
    },
  },
});
