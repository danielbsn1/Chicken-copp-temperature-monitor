import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../../app.js";
import { db } from "../../core/db.js";
import { isDatabaseReady } from "../../test-utils/db-ready.js";
import { runDailyReport } from "./reports.service.js";

// Job diário contra um Postgres real, com dados sintéticos e o Telegram simulado.
const dbReady = await isDatabaseReady(() => db.device.count());

const ID = "contrato-job";
const NAME = "Contrato job";
// "Agora" fixo: 07:00 de 15/11/2026 em São Paulo; o dia anterior é 14/11.
const NOW = new Date("2026-11-15T10:00:00Z");
const DIA = new Date("2026-11-14T00:00:00Z");
const T0 = Date.parse("2026-11-14T03:00:00Z"); // 00:00 do dia 14 em São Paulo
const DAY_MS = 86_400_000;

describe.skipIf(!dbReady)("job diário (Postgres real)", () => {
  const sentTexts = () =>
    fetchMock.mock.calls
      .map((c) => JSON.parse((c[1] as RequestInit).body as string).text as string)
      .filter((t) => t.includes(NAME));
  const fetchMock = vi.fn();
  const summary = () =>
    db.dailySummary.findUniqueOrThrow({
      where: { deviceId_day: { deviceId: ID, day: DIA } },
    });

  async function clean() {
    await db.dailySummary.deleteMany({ where: { deviceId: ID } });
    await db.reading.deleteMany({ where: { deviceId: ID } });
    await db.device.deleteMany({ where: { id: ID } });
    await db.loginAttempt.deleteMany({ where: { key: { startsWith: "contrato-job" } } });
  }

  beforeAll(async () => {
    await clean();
    await db.device.create({ data: { id: ID, name: NAME, keyHash: "x" } });
    const row = (minutes: number, tempC: number, fanOn: boolean) => ({
      deviceId: ID,
      ts: new Date(T0 + minutes * 60_000),
      tempC,
      humPct: 50,
      fanOn,
    });
    await db.reading.createMany({
      data: [
        row(0, 20, false),
        row(5, 30, true),
        row(700, 34, true),
        // 13 meses antes do "agora": deve ser apagada pela limpeza
        { ...row(0, 25, false), ts: new Date("2025-10-01T12:00:00Z") },
      ],
    });
    await db.loginAttempt.createMany({
      data: [
        { key: "contrato-job-velha", at: new Date(NOW.getTime() - 8 * DAY_MS) },
        { key: "contrato-job-nova", at: new Date(NOW.getTime() - 2 * DAY_MS) },
      ],
    });
  });
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });
  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  const telegramOk = () => {
    fetchMock.mockImplementation(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
  };
  const telegramDown = () => {
    fetchMock.mockImplementation(async () => new Response("{}", { status: 502 }));
    vi.stubGlobal("fetch", fetchMock);
  };

  it("Telegram indisponível: grava o resumo, não preenche telegram_sent_at e o dia seguinte tenta de novo", async () => {
    telegramDown();
    const first = await runDailyReport(NOW);
    expect(first.failed).toBeGreaterThanOrEqual(1);
    const row = await summary();
    expect(row).toMatchObject({
      tempMinC: 20,
      tempMaxC: 34,
      fanOnMinutes: 2,
      readingsCount: 3,
      telegramSentAt: null,
    });
    expect(sentTexts()).toHaveLength(1);

    // Próxima execução (um dia depois), Telegram de volta: reenvia o resumo do dia 14.
    fetchMock.mockReset();
    telegramOk();
    const next = new Date(NOW.getTime() + DAY_MS);
    await runDailyReport(next);
    expect(sentTexts()).toHaveLength(1);
    expect(sentTexts()[0]).toContain("Resumo de 14/11/2026");
    expect((await summary()).telegramSentAt).not.toBeNull();
  });

  it("telegram_sent_at preenchido: rodar de novo não reenvia", async () => {
    telegramOk();
    const sentAt = (await summary()).telegramSentAt;
    const result = await runDailyReport(NOW);
    expect(sentTexts()).toHaveLength(0);
    expect(result.summaries).toBeGreaterThanOrEqual(1);
    expect((await summary()).telegramSentAt).toEqual(sentAt);
  });

  it("apaga login_attempts com mais de 7 dias e readings com mais de 12 meses", async () => {
    telegramOk();
    await runDailyReport(NOW);
    const attempts = await db.loginAttempt.findMany({
      where: { key: { startsWith: "contrato-job" } },
    });
    expect(attempts.map((a) => a.key)).toEqual(["contrato-job-nova"]);
    const readings = await db.reading.count({ where: { deviceId: ID } });
    expect(readings).toBe(3);
  });

  it("a rota responde 401 sem segredo e 200 com ele", async () => {
    telegramOk();
    const app = createApp();
    expect((await request(app).get("/api/jobs/daily-report")).status).toBe(401);
    const res = await request(app)
      .get("/api/jobs/daily-report")
      .set("Authorization", "Bearer segredo-do-cron-so-para-teste");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("purged");
  });
});
