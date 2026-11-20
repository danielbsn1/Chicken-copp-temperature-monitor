import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { db } from "../../core/db.js";
import { signSession } from "../../core/session.js";
import { isDatabaseReady } from "../../test-utils/db-ready.js";

// Contrato do GET /api/readings contra um Postgres real, com dados sintéticos.
const dbReady = await isDatabaseReady(() => db.device.count());

const ID = "contrato-readings";
const ID_OUTRO = "contrato-readings-outro";
const T0 = Date.parse("2026-11-01T00:00:00Z");
const at = (minutes: number) => new Date(T0 + minutes * 60_000);

describe.skipIf(!dbReady)("GET /api/readings (Postgres real)", () => {
  const app = createApp();
  const cookie = `session=${signSession("u-contrato")}`;
  const get = (query: string) =>
    request(app).get(`/api/readings?${query}`).set("Cookie", cookie);
  const range = (bucket: string, hours = 1) =>
    `deviceId=${ID}&from=${at(0).toISOString()}&to=${at(hours * 60).toISOString()}&bucket=${bucket}`;

  async function clean() {
    for (const id of [ID, ID_OUTRO]) {
      await db.reading.deleteMany({ where: { deviceId: id } });
      await db.device.deleteMany({ where: { id } });
    }
  }

  beforeAll(async () => {
    await clean();
    await db.device.createMany({
      data: [
        { id: ID, name: "Contrato readings", keyHash: "x" },
        { id: ID_OUTRO, name: "Outro", keyHash: "y" },
      ],
    });
    const row = (deviceId: string, minutes: number, tempC: number) => ({
      deviceId,
      ts: at(minutes),
      tempC,
      humPct: 50,
      fanOn: false,
    });
    await db.reading.createMany({
      data: [
        row(ID, 0, 20),
        row(ID, 2, 24),
        row(ID, 4, 28),
        row(ID, 5, 30), // início do segundo bucket de 5m
        row(ID, 12, 26),
        row(ID, 60, 55), // fora: `to` não entra
        row(ID_OUTRO, 1, 40), // outro dispositivo não aparece
      ],
    });
  });
  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  it("agrega mínima, média e máxima em buckets de 5m alinhados ao relógio", async () => {
    const res = await get(range("5m"));
    expect(res.status).toBe(200);
    expect(res.body.points).toEqual([
      { ts: "2026-11-01T00:00:00.000Z", minC: 20, avgC: 24, maxC: 28 },
      { ts: "2026-11-01T00:05:00.000Z", minC: 30, avgC: 30, maxC: 30 },
      { ts: "2026-11-01T00:10:00.000Z", minC: 26, avgC: 26, maxC: 26 },
    ]);
    expect(res.body).toMatchObject({ deviceId: ID, bucket: "5m" });
  });

  it("1m traz um ponto por minuto com leitura", async () => {
    expect((await get(range("1m"))).body.points).toHaveLength(5);
  });

  it("15m e 1h juntam mais leituras por ponto", async () => {
    const quinze = (await get(range("15m"))).body.points;
    expect(quinze).toEqual([
      { ts: "2026-11-01T00:00:00.000Z", minC: 20, avgC: 25.6, maxC: 30 },
    ]);
    const hora = (await get(range("1h", 2))).body.points;
    expect(hora).toHaveLength(2); // 00:00 (5 leituras) e 01:00 (a de 55)
    expect(hora[1].maxC).toBe(55);
  });

  it("devolve lista vazia quando não há leituras no intervalo", async () => {
    const res = await get(
      `deviceId=${ID}&from=2026-10-01T00:00:00Z&to=2026-10-01T01:00:00Z&bucket=5m`,
    );
    expect(res.status).toBe(200);
    expect(res.body.points).toEqual([]);
  });

  it("nunca passa de 1.000 pontos: 400 quando o intervalo geraria mais", async () => {
    const res = await get(range("1m", 17)); // 1.020 buckets
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("400 com parâmetros inválidos e 401 sem sessão", async () => {
    expect((await get(`deviceId=${ID}&bucket=5m`)).status).toBe(400);
    expect((await request(app).get(`/api/readings?${range("5m")}`)).status).toBe(401);
  });

  it("usa a chave primária de readings, sem índice extra", async () => {
    const plan = await db.$transaction(async (tx) => {
      // Com poucas linhas o planejador prefere varrer a tabela; desligamos isso só para ver o índice.
      await tx.$executeRawUnsafe("SET LOCAL enable_seqscan = off");
      return tx.$queryRawUnsafe<{ "QUERY PLAN": string }[]>(
        `EXPLAIN SELECT ts FROM readings WHERE device_id = '${ID}' AND ts >= '${at(0).toISOString()}' AND ts < '${at(60).toISOString()}'`,
      );
    });
    expect(plan.map((p) => p["QUERY PLAN"]).join("\n")).toContain("readings_pkey");
  });
});
