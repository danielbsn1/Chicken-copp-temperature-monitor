import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

const row = (deviceId: string, day: string) => ({
  deviceId,
  day: new Date(`${day}T00:00:00Z`),
  tempMinC: 20,
  tempMaxC: 30,
  tempAvgC: 25,
  fanOnMinutes: 10,
  readingsCount: 100,
  telegramSentAt: null,
});

interface Setup {
  unsent?: ReturnType<typeof row>[];
  stats?: unknown;
  send?: () => Promise<void>;
}

async function load({
  unsent = [],
  stats = null,
  send = async () => undefined,
}: Setup = {}) {
  const mocks = {
    dayStats: vi.fn(async () => stats),
    upsert: vi.fn(async () => undefined),
    findUnsent: vi.fn(async () => unsent),
    markSent: vi.fn(async () => undefined),
    sendTelegram: vi.fn((_text: string) => send()),
    purgeLoginAttempts: vi.fn(async () => 3),
    purgeBefore: vi.fn(async () => 5),
    info: vi.fn(),
    warn: vi.fn(),
  };
  vi.resetModules();
  vi.doMock("../readings/index.js", () => ({
    dayStats: mocks.dayStats,
    purgeBefore: mocks.purgeBefore,
  }));
  vi.doMock("./reports.repository.js", () => ({
    upsert: mocks.upsert,
    findUnsent: mocks.findUnsent,
    markSent: mocks.markSent,
  }));
  vi.doMock("../devices/index.js", () => ({
    listDevices: async () => [{ id: "g", name: "Galinheiro" }],
  }));
  vi.doMock("../auth/index.js", () => ({ purgeLoginAttempts: mocks.purgeLoginAttempts }));
  vi.doMock("../notifications/index.js", async () => ({
    ...(await vi.importActual<object>("../notifications/index.js")),
    sendTelegram: mocks.sendTelegram,
  }));
  vi.doMock("../../core/logger.js", () => ({
    logger: { info: mocks.info, warn: mocks.warn },
  }));
  const service = await import("./reports.service.js");
  return { service, ...mocks };
}

const stats = {
  tempMinC: 20,
  tempMaxC: 30,
  tempAvgC: 25,
  fanOnMinutes: 10,
  readingsCount: 100,
};

// 10:00 UTC = 07:00 em São Paulo do dia 15; o dia anterior é 14.
const NOW = new Date("2026-11-15T10:00:00Z");

describe("saoPauloDayBefore", () => {
  it("usa o dia de São Paulo, não o de UTC", async () => {
    const { service } = await load();
    expect(service.saoPauloDayBefore(NOW, 1)).toBe("2026-11-14");
    // 01:00 UTC ainda é o dia 14 em São Paulo (22:00 do dia 14)
    expect(service.saoPauloDayBefore(new Date("2026-11-15T01:00:00Z"), 1)).toBe(
      "2026-11-13",
    );
    expect(service.saoPauloDayBefore(NOW, 3)).toBe("2026-11-12");
  });

  it("atravessa mês e ano", async () => {
    const { service } = await load();
    expect(service.saoPauloDayBefore(new Date("2026-03-01T12:00:00Z"), 1)).toBe(
      "2026-02-28",
    );
    expect(service.saoPauloDayBefore(new Date("2027-01-01T12:00:00Z"), 1)).toBe(
      "2026-12-31",
    );
  });
});

describe("runDailyReport", () => {
  it("calcula o dia anterior, envia o resumo pendente e marca telegram_sent_at", async () => {
    const m = await load({ stats, unsent: [row("g", "2026-11-14")] });
    const result = await m.service.runDailyReport(NOW);
    expect(m.dayStats).toHaveBeenCalledWith("g", "2026-11-14");
    expect(m.upsert).toHaveBeenCalledTimes(1);
    expect(m.sendTelegram).toHaveBeenCalledTimes(1);
    expect(m.sendTelegram.mock.calls[0]?.[0]).toContain(
      "Resumo de 14/11/2026 — Galinheiro",
    );
    expect(m.markSent).toHaveBeenCalledWith(
      "g",
      new Date("2026-11-14T00:00:00Z"),
      expect.any(Date),
    );
    expect(result).toMatchObject({ day: "2026-11-14", summaries: 1, sent: 1, failed: 0 });
    expect(m.info).toHaveBeenCalledWith(
      expect.objectContaining({ resumoEnviado: "sim" }),
      "job diário concluído",
    );
  });

  it("busca os pendentes dos últimos 3 dias", async () => {
    const m = await load({ stats });
    await m.service.runDailyReport(NOW);
    expect(m.findUnsent).toHaveBeenCalledWith(new Date("2026-11-12T00:00:00Z"));
  });

  it("sem pendentes (já enviado antes) não reenvia", async () => {
    const m = await load({ stats, unsent: [] });
    const result = await m.service.runDailyReport(NOW);
    expect(m.sendTelegram).not.toHaveBeenCalled();
    expect(m.markSent).not.toHaveBeenCalled();
    expect(result.sent).toBe(0);
    expect(m.info).toHaveBeenCalledWith(
      expect.objectContaining({ resumoEnviado: "não" }),
      "job diário concluído",
    );
  });

  it("Telegram indisponível: não marca como enviado, conta a falha e segue", async () => {
    const m = await load({
      stats,
      unsent: [row("g", "2026-11-13"), row("g", "2026-11-14")],
      send: async () => {
        throw new Error("Telegram indisponível (sem resposta)");
      },
    });
    const result = await m.service.runDailyReport(NOW);
    expect(m.markSent).not.toHaveBeenCalled();
    expect(result).toMatchObject({ sent: 0, failed: 2 });
    expect(m.warn).toHaveBeenCalledTimes(2);
    expect(m.purgeBefore).toHaveBeenCalled(); // a limpeza roda mesmo assim
  });

  it("dia sem leituras não conta resumo e não grava", async () => {
    const m = await load({ stats: null });
    const result = await m.service.runDailyReport(NOW);
    expect(m.upsert).not.toHaveBeenCalled();
    expect(result.summaries).toBe(0);
  });

  it("limpa tentativas de login com mais de 7 dias e leituras com mais de 12 meses", async () => {
    const m = await load({ stats });
    const result = await m.service.runDailyReport(NOW);
    expect(m.purgeLoginAttempts).toHaveBeenCalledWith(new Date("2026-11-08T10:00:00Z"));
    expect(m.purgeBefore).toHaveBeenCalledWith(new Date("2025-11-15T10:00:00Z"));
    expect(result.purged).toEqual({ loginAttempts: 3, readings: 5 });
  });

  it("o log não leva segredo", async () => {
    const m = await load({ stats, unsent: [row("g", "2026-11-14")] });
    await m.service.runDailyReport(NOW);
    expect(JSON.stringify(m.info.mock.calls)).not.toMatch(/token|segredo/i);
  });
});

describe("GET /api/jobs/daily-report", () => {
  async function app() {
    await load({ stats });
    const { reportsRouter } = await import("./index.js");
    const { errorHandler } = await import("../../core/http/error-handler.js");
    const server = express();
    server.use("/api", reportsRouter);
    server.use(errorHandler);
    return server;
  }
  const SECRET = "segredo-do-cron-so-para-teste";

  it("sem Authorization responde 401 no formato padrão", async () => {
    const res = await request(await app()).get("/api/jobs/daily-report");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("segredo errado responde 401", async () => {
    const res = await request(await app())
      .get("/api/jobs/daily-report")
      .set("Authorization", "Bearer errado");
    expect(res.status).toBe(401);
  });

  it("cookie de sessão não substitui o segredo", async () => {
    const { signSession } = await import("../../core/session.js");
    const res = await request(await app())
      .get("/api/jobs/daily-report")
      .set("Cookie", `session=${signSession("u-1")}`);
    expect(res.status).toBe(401);
  });

  it("com o segredo certo responde 200 com o resultado", async () => {
    const res = await request(await app())
      .get("/api/jobs/daily-report")
      .set("Authorization", `Bearer ${SECRET}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ summaries: 1, sent: 0, failed: 0 });
    expect(res.body.purged).toEqual({ loginAttempts: 3, readings: 5 });
  });
});

describe("agendamento", () => {
  it("o vercel.json chama o job às 10:00 UTC (7 h em São Paulo), todo dia", async () => {
    const { readFileSync } = await import("node:fs");
    const config = JSON.parse(
      readFileSync(new URL("../../../vercel.json", import.meta.url), "utf8"),
    );
    expect(config.crons).toEqual([
      { path: "/api/jobs/daily-report", schedule: "0 10 * * *" },
    ]);
  });
});
