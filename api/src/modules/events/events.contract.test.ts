import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { db } from "../../core/db.js";
import { isDatabaseReady } from "../../test-utils/db-ready.js";
import { removeTestUser, testUser } from "../../test-utils/owner.test-helper.js";

// Contrato do GET /api/events contra um Postgres real, com dados sintéticos.
const dbReady = await isDatabaseReady(() => db.device.count());

const ID = "contrato-events";
const ID_OUTRO = "contrato-events-outro";
const T0 = Date.parse("2026-11-01T00:00:00Z");
const at = (minutes: number) => new Date(T0 + minutes * 60_000);

describe.skipIf(!dbReady)("GET /api/events (Postgres real)", () => {
  const app = createApp();
  const EMAIL = "contrato-events@example.com";
  let cookie = "";
  let ownerId = "";
  const get = (query: string) =>
    request(app).get(`/api/events?${query}`).set("Cookie", cookie);

  async function clean() {
    for (const id of [ID, ID_OUTRO]) {
      await db.event.deleteMany({ where: { deviceId: id } });
      await db.device.deleteMany({ where: { id } });
    }
  }

  beforeAll(async () => {
    await clean();
    const owner = await testUser(EMAIL);
    cookie = owner.cookie;
    ownerId = owner.id;
    await db.device.createMany({
      data: [
        { id: ID, name: "Contrato events", keyHash: "x", ownerId },
        { id: ID_OUTRO, name: "Outro", keyHash: "y", ownerId },
      ],
    });
    await db.event.createMany({
      data: [
        { deviceId: ID, ts: at(0), type: "boot" },
        { deviceId: ID, ts: at(10), type: "fan_on", detail: { tempC: 31 } },
        { deviceId: ID, ts: at(20), type: "fan_off" },
        { deviceId: ID, ts: at(20), type: "boot" }, // mesmo instante, outro tipo
        { deviceId: ID, ts: at(30), type: "fan_on" },
        { deviceId: ID_OUTRO, ts: at(15), type: "fan_on" },
      ],
    });
  });
  afterAll(async () => {
    await clean();
    await removeTestUser(EMAIL);
    await db.$disconnect();
  });

  it("lista do mais novo para o mais antigo, só do dispositivo pedido", async () => {
    const res = await get(`deviceId=${ID}`);
    expect(res.status).toBe(200);
    expect(
      res.body.events.map((e: { ts: string; type: string }) => [e.ts, e.type]),
    ).toEqual([
      [at(30).toISOString(), "fan_on"],
      [at(20).toISOString(), "fan_off"],
      [at(20).toISOString(), "boot"],
      [at(10).toISOString(), "fan_on"],
      [at(0).toISOString(), "boot"],
    ]);
    expect(res.body.events[3].detail).toEqual({ tempC: 31 });
    expect(res.body.events[0].detail).toBeNull();
  });

  it("filtra por intervalo (from entra, to não entra) e por tipo", async () => {
    const janela = await get(
      `deviceId=${ID}&from=${at(10).toISOString()}&to=${at(30).toISOString()}`,
    );
    expect(janela.body.events).toHaveLength(3);
    const tipo = await get(`deviceId=${ID}&type=fan_on`);
    expect(tipo.body.events.map((e: { type: string }) => e.type)).toEqual([
      "fan_on",
      "fan_on",
    ]);
  });

  it("respeita o limit mantendo os mais novos", async () => {
    const res = await get(`deviceId=${ID}&limit=2`);
    expect(res.body.events).toHaveLength(2);
    expect(res.body.events[0].ts).toBe(at(30).toISOString());
  });

  it("400 com parâmetros inválidos e 401 sem sessão", async () => {
    expect((await get(`deviceId=${ID}&limit=201`)).status).toBe(400);
    expect((await get(`deviceId=${ID}&type=explodiu`)).status).toBe(400);
    expect((await get(`limit=10`)).status).toBe(400);
    expect((await request(app).get(`/api/events?deviceId=${ID}`)).status).toBe(401);
  });

  it("usa a chave primária de events, sem índice extra", async () => {
    const plan = await db.$transaction(async (tx) => {
      // Com poucas linhas o planejador prefere varrer a tabela; desligamos isso só para ver o índice.
      await tx.$executeRawUnsafe("SET LOCAL enable_seqscan = off");
      return tx.$queryRawUnsafe<{ "QUERY PLAN": string }[]>(
        `EXPLAIN SELECT ts FROM events WHERE device_id = '${ID}' AND ts >= '${at(0).toISOString()}' ORDER BY ts DESC LIMIT 10`,
      );
    });
    expect(plan.map((p) => p["QUERY PLAN"]).join("\n")).toContain("events_pkey");
  });
});
