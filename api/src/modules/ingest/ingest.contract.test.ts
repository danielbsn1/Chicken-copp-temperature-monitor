import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../../app.js";
import { db } from "../../core/db.js";
import { registerDevice } from "../devices/index.js";

// Contrato do /ingest contra um Postgres real. Se o banco não está no ar ou não
// tem as migrações (na CI os testes rodam antes do db:deploy), o bloco é pulado.
const dbReady = await db.device.count().then(
  () => true,
  () => false,
);

const ID = "contrato-ingest";
const iso = (minutesAgo: number) =>
  new Date(Date.now() - minutesAgo * 60_000).toISOString();

describe.skipIf(!dbReady)("POST /api/ingest (Postgres real)", () => {
  const app = createApp();
  let key: string;

  const send = (body: unknown, k = key) =>
    request(app)
      .post("/api/ingest")
      .set("X-Device-Key", k)
      .send(body as object);
  const lote = (over: Record<string, unknown> = {}) => ({
    deviceId: ID,
    fwVersion: "2.0.1",
    samples: [
      { ts: iso(10), tempC: 25.5, humPct: 61, fanOn: false },
      { ts: iso(9), tempC: 26, humPct: 60, fanOn: true },
    ],
    events: [{ ts: iso(8), type: "fan_on", detail: { tempC: 31 } }],
    ...over,
  });

  async function clean() {
    await db.reading.deleteMany({ where: { deviceId: ID } });
    await db.event.deleteMany({ where: { deviceId: ID } });
    await db.device.deleteMany({ where: { id: ID } });
  }

  beforeAll(async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("OK")),
    );
    await clean();
    key = (await registerDevice(ID, "Contrato do ingest")).key;
  });
  afterAll(async () => {
    vi.unstubAllGlobals();
    await clean();
    await db.$disconnect();
  });

  it("lote válido: 200 e grava amostras, eventos, last_seen_at e fw_version", async () => {
    const res = await send(lote());
    expect(res.status).toBe(200);
    expect(res.headers["x-request-id"]).toBeTruthy();
    expect(res.body).toEqual({ accepted: 3, duplicates: 0, rejected: 0 });
    expect(await db.reading.count({ where: { deviceId: ID } })).toBe(2);
    expect(await db.event.count({ where: { deviceId: ID } })).toBe(1);
    const device = await db.device.findUniqueOrThrow({ where: { id: ID } });
    expect(device.fwVersion).toBe("2.0.1");
    expect(device.lastSeenAt).not.toBeNull();
  });

  it("o mesmo lote reenviado não duplica nada", async () => {
    const body = lote({
      samples: [{ ts: iso(20), tempC: 20, humPct: 50, fanOn: false }],
      events: [],
    });
    expect((await send(body)).body).toEqual({ accepted: 1, duplicates: 0, rejected: 0 });
    expect((await send(body)).body).toEqual({ accepted: 0, duplicates: 1, rejected: 0 });
  });

  it("duas requisições simultâneas do mesmo lote não duplicam", async () => {
    const body = lote({
      samples: [{ ts: iso(30), tempC: 22, humPct: 55, fanOn: false }],
      events: [],
    });
    const [a, b] = await Promise.all([send(body), send(body)]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(a.body.accepted + b.body.accepted).toBe(1);
    expect(a.body.duplicates + b.body.duplicates).toBe(1);
  });

  it("item ruim entra em rejected e o resto é gravado, com 200", async () => {
    const res = await send(
      lote({
        samples: [
          { ts: iso(40), tempC: 99, humPct: 50, fanOn: false },
          { ts: "1970-01-01T00:00:00Z", tempC: 20, humPct: 50, fanOn: false },
          { ts: iso(41), tempC: 20, humPct: 50, fanOn: false },
        ],
        events: [{ ts: iso(40), type: "explodiu" }],
      }),
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ accepted: 1, duplicates: 0, rejected: 3 });
  });

  it("lote com formato inválido recebe 400 e não grava nada", async () => {
    const before = await db.reading.count({ where: { deviceId: ID } });
    const res = await send({ deviceId: ID, samples: "x" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(await db.reading.count({ where: { deviceId: ID } })).toBe(before);
  });

  it("chave inválida recebe 401 e não grava nada", async () => {
    const before = await db.reading.count({ where: { deviceId: ID } });
    const res = await send(lote(), "0".repeat(64));
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
    expect(await db.reading.count({ where: { deviceId: ID } })).toBe(before);
  });

  it("last_seen_at nunca volta com um lote antigo", async () => {
    const antes = (await db.device.findUniqueOrThrow({ where: { id: ID } })).lastSeenAt;
    await send(lote({ samples: [], events: [] }));
    const depois = (await db.device.findUniqueOrThrow({ where: { id: ID } })).lastSeenAt;
    expect(depois!.getTime()).toBeGreaterThanOrEqual(antes!.getTime());
  });

  it("é atômico: se a gravação falha, nada do lote fica", async () => {
    // O evento de um dispositivo inexistente viola a chave estrangeira depois de as amostras entrarem.
    const before = await db.reading.count({ where: { deviceId: ID } });
    const { saveMany } = await import("../events/index.js");
    const { runInTransaction } = await import("./ingest.repository.js");
    const { saveMany: saveReadings } = await import("../readings/index.js");
    await expect(
      runInTransaction(async (tx) => {
        await saveReadings(
          [
            {
              deviceId: ID,
              ts: new Date(Date.now() - 50 * 60_000),
              tempC: 20,
              humPct: 50,
              fanOn: false,
            },
          ],
          tx,
        );
        await saveMany(
          [{ deviceId: "dispositivo-inexistente", ts: new Date(), type: "boot" }],
          tx,
        );
      }),
    ).rejects.toThrow();
    expect(await db.reading.count({ where: { deviceId: ID } })).toBe(before);
  });
});
