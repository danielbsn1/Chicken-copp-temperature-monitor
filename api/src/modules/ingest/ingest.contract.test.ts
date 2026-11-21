import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../app.js";
import { db } from "../../core/db.js";
import { isDatabaseReady } from "../../test-utils/db-ready.js";
import { registerDevice } from "../devices/index.js";
import {
  invalidEvents,
  invalidSamples,
  items,
  minutesAgo,
  oversizedBatch,
  validBatch,
  validEvent,
  validSample,
} from "./__fixtures__/payloads.js";

// Contrato do /ingest contra um Postgres real e descartável (ver test-utils/db-ready.ts).
const dbReady = await isDatabaseReady(() => db.device.count());

const ID = "contrato-ingest";
const ID_LIMITE = "contrato-ingest-limite";
const ID_OUTRO = "contrato-ingest-outro";

describe.skipIf(!dbReady)("POST /api/ingest (Postgres real)", () => {
  const app = createApp();
  let key: string;
  let keyLimite: string;
  let keyOutro: string;

  const send = (body: unknown, k = key) =>
    request(app)
      .post("/api/ingest")
      .set("X-Device-Key", k)
      .send(body as object);
  const readings = () => db.reading.count({ where: { deviceId: ID } });
  const events = () => db.event.count({ where: { deviceId: ID } });

  async function clean() {
    for (const id of [ID, ID_LIMITE, ID_OUTRO]) {
      await db.reading.deleteMany({ where: { deviceId: id } });
      await db.event.deleteMany({ where: { deviceId: id } });
      await db.device.deleteMany({ where: { id } });
    }
  }

  beforeAll(async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("OK")),
    );
    await clean();
    key = (await registerDevice(ID, "Contrato do ingest")).key;
    keyLimite = (await registerDevice(ID_LIMITE, "Contrato do limite")).key;
    keyOutro = (await registerDevice(ID_OUTRO, "Contrato de outro dispositivo")).key;
  });
  afterAll(async () => {
    vi.unstubAllGlobals();
    await clean();
    await db.$disconnect();
  });

  describe("lote válido", () => {
    it("200, grava amostras, eventos, last_seen_at e fw_version", async () => {
      const res = await send(validBatch(ID));
      expect(res.status).toBe(200);
      expect(res.headers["x-request-id"]).toBeTruthy();
      expect(res.body).toEqual({ accepted: 3, duplicates: 0, rejected: 0 });
      expect(await readings()).toBe(2);
      expect(await events()).toBe(1);
      const device = await db.device.findUniqueOrThrow({ where: { id: ID } });
      expect(device.fwVersion).toBe("2.0.1");
      expect(device.lastSeenAt).not.toBeNull();
    });

    it("lote vazio também é 200 e atualiza last_seen_at", async () => {
      const before = (await db.device.findUniqueOrThrow({ where: { id: ID } }))
        .lastSeenAt;
      const res = await send(validBatch(ID, { samples: [], events: [] }));
      expect(res.body).toEqual({ accepted: 0, duplicates: 0, rejected: 0 });
      const after = (await db.device.findUniqueOrThrow({ where: { id: ID } })).lastSeenAt;
      expect(after!.getTime()).toBeGreaterThanOrEqual(before!.getTime());
    });

    it("aceita exatamente 100 amostras e 100 eventos", async () => {
      const res = await send(
        validBatch(ID, {
          samples: items(100, (i) => validSample(100 + i)),
          events: items(100, (i) => validEvent(300 + i)),
        }),
      );
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ accepted: 200, duplicates: 0, rejected: 0 });
    });
  });

  describe("lote repetido", () => {
    it("reenviar o mesmo lote não duplica nada", async () => {
      const body = validBatch(ID, { samples: [validSample(500)], events: [] });
      expect((await send(body)).body).toEqual({
        accepted: 1,
        duplicates: 0,
        rejected: 0,
      });
      expect((await send(body)).body).toEqual({
        accepted: 0,
        duplicates: 1,
        rejected: 0,
      });
    });

    it("duas requisições simultâneas do mesmo lote não duplicam", async () => {
      const body = validBatch(ID, { samples: [validSample(510)], events: [] });
      const [a, b] = await Promise.all([send(body), send(body)]);
      expect([a.status, b.status]).toEqual([200, 200]);
      expect(a.body.accepted + b.body.accepted).toBe(1);
      expect(a.body.duplicates + b.body.duplicates).toBe(1);
    });
  });

  describe("itens inválidos entram em rejected e o resto é gravado", () => {
    it.each(
      Object.entries(invalidSamples).map(([nome, item], i) => [nome, item, i] as const),
    )("amostra com %s", async (_nome, ruim, i) => {
      const before = await readings();
      const res = await send(
        validBatch(ID, { samples: [ruim, validSample(520 + i)], events: [] }),
      );
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ accepted: 1, duplicates: 0, rejected: 1 });
      expect(await readings()).toBe(before + 1);
    });

    it.each(Object.entries(invalidEvents))("evento com %s", async (_nome, ruim) => {
      const before = await events();
      const res = await send(validBatch(ID, { samples: [], events: [ruim] }));
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ accepted: 0, duplicates: 0, rejected: 1 });
      expect(await events()).toBe(before);
    });

    it("lote misto: grava o que presta e conta o que não presta", async () => {
      const res = await send(
        validBatch(ID, {
          samples: [
            invalidSamples.tempAcimaDe60,
            validSample(530),
            invalidSamples.tsNaoIso,
            validSample(531),
          ],
          events: [
            invalidEvents.tipoDesconhecido,
            validEvent(532, { type: "boot", detail: {} }),
          ],
        }),
      );
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ accepted: 3, duplicates: 0, rejected: 3 });
    });
  });

  describe("lote com formato inválido: 400 e nada é gravado", () => {
    it.each([
      ["mais de 100 amostras", { samples: items(101, (i) => validSample(600 + i)) }],
      ["mais de 100 eventos", { events: items(101, (i) => validEvent(800 + i)) }],
      ["samples que não é lista", { samples: "x" }],
      ["sem fwVersion", { fwVersion: undefined }],
      ["sem deviceId", { deviceId: undefined }],
    ])("%s", async (_nome, over) => {
      const [r, e] = [await readings(), await events()];
      const res = await send(validBatch(ID, over));
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.details.length).toBeGreaterThan(0);
      expect([await readings(), await events()]).toEqual([r, e]);
    });

    it("corpo acima de 100 KB: 413 no formato padrão e nada é gravado", async () => {
      const [r, e] = [await readings(), await events()];
      const res = await send(oversizedBatch(ID));
      expect(res.status).toBe(413);
      expect(res.body.error.code).toBe("PAYLOAD_TOO_LARGE");
      expect([await readings(), await events()]).toEqual([r, e]);
    });
  });

  describe("autenticação", () => {
    it.each([
      ["chave inválida", "0".repeat(64)],
      ["chave vazia", ""],
    ])("%s: 401 e nada é gravado", async (_nome, k) => {
      const [r, e] = [await readings(), await events()];
      const res = await send(validBatch(ID, { samples: [validSample(700)] }), k);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
      expect(JSON.stringify(res.body)).not.toContain(key);
      expect([await readings(), await events()]).toEqual([r, e]);
    });

    it("chave de outro dispositivo não grava no deviceId informado", async () => {
      const res = await send(validBatch(ID, { samples: [validSample(710)] }), keyOutro);
      expect(res.status).toBe(401);
    });
  });

  it("é atômico: se a gravação falha no meio, nada do lote fica", async () => {
    const before = await readings();
    const { saveMany: saveEvents } = await import("../events/index.js");
    const { saveMany: saveReadings } = await import("../readings/index.js");
    const { runInTransaction } = await import("./ingest.repository.js");
    await expect(
      runInTransaction(async (tx) => {
        await saveReadings(
          [
            {
              deviceId: ID,
              ts: new Date(minutesAgo(900)),
              tempC: 20,
              humPct: 50,
              fanOn: false,
            },
          ],
          tx,
        );
        // Dispositivo inexistente viola a chave estrangeira depois de as amostras entrarem.
        await saveEvents([{ deviceId: "nao-existe", ts: new Date(), type: "boot" }], tx);
      }),
    ).rejects.toThrow();
    expect(await readings()).toBe(before);
  });

  it("limite de 30 requisições por minuto: a 31ª responde 429", async () => {
    const send30 = (k: string) =>
      request(app)
        .post("/api/ingest")
        .set("X-Device-Key", k)
        .send(validBatch(ID_LIMITE, { samples: [], events: [] }));
    for (let i = 0; i < 30; i++) {
      expect((await send30(keyLimite)).status).toBe(200);
    }
    const res = await send30(keyLimite);
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe("RATE_LIMITED");
    expect(res.headers["x-request-id"]).toBeTruthy();
    // O limite é por dispositivo: o outro continua atendido.
    const outro = await send(validBatch(ID, { samples: [], events: [] }));
    expect(outro.status).toBe(200);
  });
});

// De ponta a ponta: lote real no Postgres, Healthchecks simulado (ver HC_PING_URL no vitest.config.ts).
describe.skipIf(!dbReady)(
  "aviso ao Healthchecks no POST /api/ingest (Postgres real)",
  () => {
    const app = createApp();
    const HC_ID = "contrato-ingest-hc";
    let key: string;
    const fetchMock = vi.fn();
    const send = () =>
      request(app)
        .post("/api/ingest")
        .set("X-Device-Key", key)
        .send(validBatch(HC_ID) as object);
    const pings = () =>
      fetchMock.mock.calls.filter((c) =>
        String(c[0]).startsWith("https://hc-ping.test/"),
      );

    beforeAll(async () => {
      await db.reading.deleteMany({ where: { deviceId: HC_ID } });
      await db.event.deleteMany({ where: { deviceId: HC_ID } });
      await db.device.deleteMany({ where: { id: HC_ID } });
      key = (await registerDevice(HC_ID, "Contrato do Healthchecks")).key;
    });
    beforeEach(() => {
      fetchMock.mockReset();
      vi.stubGlobal("fetch", fetchMock);
    });
    afterAll(async () => {
      vi.unstubAllGlobals();
      await db.reading.deleteMany({ where: { deviceId: HC_ID } });
      await db.event.deleteMany({ where: { deviceId: HC_ID } });
      await db.device.deleteMany({ where: { id: HC_ID } });
    });

    it("lote válido: grava, responde 200 e faz o ping em HC_PING_URL uma vez", async () => {
      fetchMock.mockResolvedValue(new Response("OK"));
      const res = await send();
      expect(res.status).toBe(200);
      expect(res.body.accepted).toBe(3);
      expect(pings()).toHaveLength(1);
      expect(pings()[0]?.[0]).toBe(
        "https://hc-ping.test/00000000-0000-0000-0000-000000000000",
      );
    });

    it("ping que falha (rede): o ingest responde 200 e o lote fica gravado", async () => {
      fetchMock.mockRejectedValue(new Error("sem rede"));
      const res = await send();
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ accepted: 0, duplicates: 3, rejected: 0 });
      expect(await db.reading.count({ where: { deviceId: HC_ID } })).toBe(2);
    });

    it("Healthchecks respondendo 500: o ingest continua 200", async () => {
      fetchMock.mockResolvedValue(new Response("erro", { status: 500 }));
      expect((await send()).status).toBe(200);
    });

    it("ping lento: a resposta ao ESP32 não espera o ping terminar", async () => {
      fetchMock.mockImplementation(() => new Promise<Response>(() => undefined)); // nunca responde
      const startedAt = Date.now();
      const res = await send();
      expect(res.status).toBe(200);
      expect(Date.now() - startedAt).toBeLessThan(2_000);
    });

    it("lote inválido ou sem chave: nenhum ping", async () => {
      await request(app)
        .post("/api/ingest")
        .send(validBatch(HC_ID) as object);
      await request(app)
        .post("/api/ingest")
        .set("X-Device-Key", key)
        .send({ deviceId: HC_ID });
      expect(pings()).toHaveLength(0);
    });
  },
);
