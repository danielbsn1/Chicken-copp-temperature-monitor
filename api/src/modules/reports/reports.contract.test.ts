import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { db } from "../../core/db.js";
import { signSession } from "../../core/session.js";
import { calculateDailySummary } from "./reports.service.js";
import { isDatabaseReady } from "../../test-utils/db-ready.js";

// Contrato do GET /api/reports/daily contra um Postgres real, com dados sintéticos.
const dbReady = await isDatabaseReady(() => db.device.count());

const ID = "contrato-reports";
const ID_OUTRO = "contrato-reports-outro";
// 2026-11-14 em São Paulo (UTC−3) vai de 03:00Z do dia 14 até 03:00Z do dia 15.
const DIA_INICIO = Date.parse("2026-11-14T03:00:00Z");
const at = (minutes: number) => new Date(DIA_INICIO + minutes * 60_000);

describe.skipIf(!dbReady)("GET /api/reports/daily (Postgres real)", () => {
  const app = createApp();
  const cookie = `session=${signSession("u-contrato")}`;
  const get = (day: string, deviceId = ID, extra = "") =>
    request(app)
      .get(`/api/reports/daily?deviceId=${deviceId}&day=${day}${extra}`)
      .set("Cookie", cookie);
  const summaryRow = (day: string) =>
    db.dailySummary.findMany({
      where: { deviceId: ID, day: new Date(`${day}T00:00:00Z`) },
    });

  async function clean() {
    for (const id of [ID, ID_OUTRO]) {
      await db.dailySummary.deleteMany({ where: { deviceId: id } });
      await db.reading.deleteMany({ where: { deviceId: id } });
      await db.device.deleteMany({ where: { id } });
    }
  }

  beforeAll(async () => {
    await clean();
    await db.device.createMany({
      data: [
        { id: ID, name: "Contrato reports", keyHash: "x" },
        { id: ID_OUTRO, name: "Outro", keyHash: "y" },
      ],
    });
    const row = (deviceId: string, minutes: number, tempC: number, fanOn = false) => ({
      deviceId,
      ts: at(minutes),
      tempC,
      humPct: 50,
      fanOn,
    });
    await db.reading.createMany({
      data: [
        row(ID, -1, 50), // 23:59 do dia 13 em São Paulo: fora
        row(ID, 0, 20), // 00:00 do dia 14: dentro (início inclusivo)
        row(ID, 1, 24, true),
        // lacuna longa: nenhuma leitura entre o minuto 1 e o 600
        row(ID, 600, 32, true),
        row(ID, 601, 36, true),
        row(ID, 1439, 28), // 23:59 do dia 14: dentro
        row(ID, 1440, 55), // 00:00 do dia 15: fora (fim exclusivo)
        row(ID_OUTRO, 5, 40, true), // outro dispositivo não entra
        row(ID, 3000, 25), // dia 16: um dia à parte
      ],
    });
  });
  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  it("sem resumo gravado, GET responde 404 mesmo havendo leituras (quem calcula é o job)", async () => {
    const res = await get("2026-11-14");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    expect(await summaryRow("2026-11-14")).toHaveLength(0);
  });

  it("calcula mínima, máxima, média, minutos de ventilador e leituras com lacunas", async () => {
    // dentro do dia: 20, 24, 32, 36, 28 → média 28; ventilador em 3 amostras
    expect(await calculateDailySummary({ deviceId: ID, day: "2026-11-14" })).toEqual({
      deviceId: ID,
      day: "2026-11-14",
      tempMinC: 20,
      tempMaxC: 36,
      tempAvgC: 28,
      fanOnMinutes: 3,
      readingsCount: 5,
    });
  });

  it("GET devolve o resumo gravado em JSON", async () => {
    const res = await get("2026-11-14");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      deviceId: ID,
      day: "2026-11-14",
      tempMinC: 20,
      tempMaxC: 36,
      tempAvgC: 28,
      fanOnMinutes: 3,
      readingsCount: 5,
    });
  });

  it("GET com format=csv baixa o arquivo com cabeçalho e unidades", async () => {
    const res = await get("2026-11-14", ID, "&format=csv");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("text/csv; charset=utf-8");
    expect(res.headers["content-disposition"]).toContain(`resumo-${ID}-2026-11-14.csv`);
    expect(res.text).toBe(
      "\uFEFFDia,Temperatura mínima (°C),Temperatura máxima (°C),Temperatura média (°C),Ventilador ligado (min),Leituras\r\n" +
        "2026-11-14,20,36,28,3,5\r\n",
    );
  });

  it("o dia segue America/Sao_Paulo: 02:59Z fica no dia anterior e 03:00Z abre o dia", async () => {
    expect(
      await calculateDailySummary({ deviceId: ID, day: "2026-11-13" }),
    ).toMatchObject({
      readingsCount: 1,
      tempMaxC: 50,
    });
    expect(
      await calculateDailySummary({ deviceId: ID, day: "2026-11-15" }),
    ).toMatchObject({
      readingsCount: 1,
      tempMaxC: 55,
    });
  });

  it("recalcular o mesmo dia regrava a mesma linha (upsert)", async () => {
    const q = { deviceId: ID, day: "2026-11-14" } as const;
    expect(await calculateDailySummary(q)).toEqual(await calculateDailySummary(q));
    expect(await summaryRow("2026-11-14")).toHaveLength(1);
  });

  it("recalcular depois de novas leituras atualiza a mesma linha e o GET acompanha", async () => {
    await db.reading.create({
      data: { deviceId: ID, ts: at(700), tempC: 40, humPct: 50, fanOn: true },
    });
    await calculateDailySummary({ deviceId: ID, day: "2026-11-14" });
    expect((await get("2026-11-14")).body).toMatchObject({
      tempMaxC: 40,
      readingsCount: 6,
      fanOnMinutes: 4,
    });
    expect(await summaryRow("2026-11-14")).toHaveLength(1);
  });

  it("dia sem leituras: nada é gravado e o GET responde 404", async () => {
    expect(await calculateDailySummary({ deviceId: ID, day: "2026-11-20" })).toBeNull();
    expect(await summaryRow("2026-11-20")).toHaveLength(0);
    expect((await get("2026-11-20")).status).toBe(404);
  });

  it("outro dispositivo tem o resumo próprio", async () => {
    await calculateDailySummary({
      deviceId: ID_OUTRO,
      day: "2026-11-14",
    });
    const res = await get("2026-11-14", ID_OUTRO);
    expect(res.body).toMatchObject({ readingsCount: 1, tempMinC: 40, fanOnMinutes: 1 });
  });

  it("exige sessão e valida day e format", async () => {
    expect(
      (await request(app).get(`/api/reports/daily?deviceId=${ID}&day=2026-11-14`)).status,
    ).toBe(401);
    expect((await get("2026-02-30")).status).toBe(400);
    expect((await get("2026-11-14", ID, "&format=pdf")).status).toBe(400);
  });
});
