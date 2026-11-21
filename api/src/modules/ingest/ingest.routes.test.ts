import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UnauthorizedError } from "../../core/errors.js";
import { errorHandler } from "../../core/http/error-handler.js";

const ingestBatch = vi.hoisted(() => vi.fn());
const pingInBackground = vi.hoisted(() => vi.fn());

vi.mock("./ingest.service.js", () => ({ ingestBatch }));
vi.mock("../health/index.js", () => ({ pingInBackground }));
vi.mock("../devices/index.js", () => ({
  // Dublê do guarda: a chave "dev-N" autentica o dispositivo "dev-N".
  requireDeviceKey: (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    const key = req.header("x-device-key");
    if (!key?.startsWith("dev-")) return next(new UnauthorizedError());
    res.locals.deviceId = key;
    next();
  },
}));

const { ingestRouter } = await import("./index.js");

function app() {
  const a = express();
  a.use(express.json({ limit: "100kb" }));
  a.use("/api", ingestRouter);
  a.use(errorHandler);
  return a;
}

let n = 0;
let key: string;
const body = (over: Record<string, unknown> = {}) => ({
  deviceId: key,
  fwVersion: "1.0.0",
  samples: [],
  events: [],
  ...over,
});

beforeEach(() => {
  ingestBatch.mockReset();
  pingInBackground.mockReset();
  ingestBatch.mockResolvedValue({ accepted: 3, duplicates: 1, rejected: 2 });
  key = `dev-${++n}`;
});

describe("POST /api/ingest", () => {
  it("200 com accepted, duplicates e rejected", async () => {
    const res = await request(app())
      .post("/api/ingest")
      .set("X-Device-Key", key)
      .send(body());
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ accepted: 3, duplicates: 1, rejected: 2 });
    expect(ingestBatch).toHaveBeenCalledWith(key, body());
  });

  it("401 sem a chave do dispositivo", async () => {
    const res = await request(app()).post("/api/ingest").send(body());
    expect(res.status).toBe(401);
    expect(ingestBatch).not.toHaveBeenCalled();
  });

  it.each([
    ["sem deviceId", { deviceId: undefined }],
    ["sem fwVersion", { fwVersion: undefined }],
    ["sem samples", { samples: undefined }],
    ["sem events", { events: undefined }],
    ["samples que não é lista", { samples: "x" }],
    ["mais de 100 amostras", { samples: Array.from({ length: 101 }, () => ({})) }],
    ["mais de 100 eventos", { events: Array.from({ length: 101 }, () => ({})) }],
  ])("400 com details para lote %s", async (_nome, over) => {
    const res = await request(app())
      .post("/api/ingest")
      .set("X-Device-Key", key)
      .send(body(over));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details.length).toBeGreaterThan(0);
    expect(ingestBatch).not.toHaveBeenCalled();
  });

  it("aceita exatamente 100 itens em cada lista", async () => {
    const res = await request(app())
      .post("/api/ingest")
      .set("X-Device-Key", key)
      .send(
        body({
          samples: Array.from({ length: 100 }, () => ({})),
          events: Array.from({ length: 100 }, () => ({})),
        }),
      );
    expect(res.status).toBe(200);
  });

  it("400 para JSON malformado", async () => {
    const res = await request(app())
      .post("/api/ingest")
      .set("X-Device-Key", key)
      .set("Content-Type", "application/json")
      .send("{oops");
    expect(res.status).toBe(400);
  });
});

describe("limite de 30 requisições por minuto por dispositivo", () => {
  it("a 31ª responde 429 no formato padrão", async () => {
    const a = app();
    for (let i = 0; i < 30; i++) {
      const ok = await request(a)
        .post("/api/ingest")
        .set("X-Device-Key", key)
        .send(body());
      expect(ok.status).toBe(200);
    }
    const res = await request(a)
      .post("/api/ingest")
      .set("X-Device-Key", key)
      .send(body());
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe("RATE_LIMITED");
  });

  it("o limite de um dispositivo não afeta outro", async () => {
    const a = app();
    for (let i = 0; i < 31; i++) {
      await request(a).post("/api/ingest").set("X-Device-Key", key).send(body());
    }
    const outro = await request(a)
      .post("/api/ingest")
      .set("X-Device-Key", `dev-outro-${n}`)
      .send(body());
    expect(outro.status).toBe(200);
  });
});

describe("aviso ao Healthchecks", () => {
  it("lote válido: o ping é disparado uma vez, depois de a resposta ser montada", async () => {
    const res = await request(app())
      .post("/api/ingest")
      .set("X-Device-Key", key)
      .send(body());
    expect(res.status).toBe(200);
    expect(pingInBackground).toHaveBeenCalledOnce();
  });

  it.each([
    ["sem a chave", undefined, body()],
    ["lote inválido", true, body({ samples: "x" })],
  ])("%s: não avisa o Healthchecks", async (_nome, withKey, payload) => {
    const req = request(app()).post("/api/ingest");
    if (withKey) req.set("X-Device-Key", key);
    await req.send(payload);
    expect(pingInBackground).not.toHaveBeenCalled();
  });

  it("falha na gravação: o erro sobe e o Healthchecks não é avisado", async () => {
    ingestBatch.mockRejectedValue(new Error("banco caiu"));
    const res = await request(app())
      .post("/api/ingest")
      .set("X-Device-Key", key)
      .send(body());
    expect(res.status).toBe(500);
    expect(pingInBackground).not.toHaveBeenCalled();
  });
});
