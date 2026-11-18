import { describe, expect, it } from "vitest";
import { loadEnv } from "./env.js";

const valid = {
  NODE_ENV: "development",
  DATABASE_URL: "postgres://u:p@localhost:5433/db",
  DIRECT_URL: "postgres://u:p@localhost:5433/db",
  SESSION_SECRET: "x".repeat(32),
  CRON_SECRET: "y".repeat(16),
  TELEGRAM_BOT_TOKEN: "123:abc",
  TELEGRAM_CHAT_ID: "-100",
  HC_PING_URL: "https://hc-ping.com/abc",
  WEB_ORIGIN: "http://localhost:5173",
};

describe("loadEnv", () => {
  it("aceita um ambiente completo", () => {
    expect(loadEnv(valid).WEB_ORIGIN).toBe("http://localhost:5173");
  });

  it("falha quando falta uma variável e cita o nome dela", () => {
    const { CRON_SECRET: _omitted, ...incomplete } = valid;
    expect(() => loadEnv(incomplete)).toThrow(/CRON_SECRET/);
  });

  it("falha com valor inválido sem revelar o valor", () => {
    const secret = "curto";
    try {
      loadEnv({ ...valid, SESSION_SECRET: secret });
      expect.unreachable();
    } catch (err) {
      expect((err as Error).message).toContain("SESSION_SECRET");
      expect((err as Error).message).not.toContain(secret);
    }
  });
});
