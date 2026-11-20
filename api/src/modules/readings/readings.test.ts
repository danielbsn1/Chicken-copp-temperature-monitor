import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { signSession } from "../../core/session.js";
import { readingsRouter } from "./index.js";

describe("módulo readings", () => {
  it("expõe o router pela interface pública", () => {
    expect(typeof readingsRouter).toBe("function");
  });
});

describe("latestReading", () => {
  it("devolve a última leitura do repositório", async () => {
    const reading = { ts: new Date(), tempC: 25, humPct: 50, fanOn: false };
    vi.resetModules();
    vi.doMock("./readings.repository.js", () => ({ findLatest: async () => reading }));
    const { latestReading } = await import("./readings.service.js");
    expect(await latestReading("g")).toBe(reading);
  });
});

describe("saveMany", () => {
  it("repassa as linhas e a transação e devolve quantas foram gravadas", async () => {
    const createMany = vi.fn(async () => 2);
    vi.resetModules();
    vi.doMock("./readings.repository.js", () => ({ createMany }));
    const { saveMany } = await import("./readings.service.js");
    const rows = [{ deviceId: "g", ts: new Date(), tempC: 25, humPct: 50, fanOn: false }];
    const tx = { tx: true };
    expect(await saveMany(rows, tx as never)).toBe(2);
    expect(createMany).toHaveBeenCalledWith(rows, tx);
  });
});

describe("temperatureSeries", () => {
  it("monta a série em ISO e arredonda a média", async () => {
    const aggregate = vi.fn(async () => [
      { bucket: new Date("2026-11-01T00:05:00Z"), minC: 24.5, avgC: 25.123456, maxC: 26 },
    ]);
    vi.resetModules();
    vi.doMock("./readings.repository.js", () => ({ aggregate }));
    const { temperatureSeries } = await import("./readings.service.js");
    const from = new Date("2026-11-01T00:00:00Z");
    const to = new Date("2026-11-01T01:00:00Z");
    expect(await temperatureSeries({ deviceId: "g", from, to, bucket: "5m" })).toEqual({
      deviceId: "g",
      from: "2026-11-01T00:00:00.000Z",
      to: "2026-11-01T01:00:00.000Z",
      bucket: "5m",
      points: [{ ts: "2026-11-01T00:05:00.000Z", minC: 24.5, avgC: 25.12, maxC: 26 }],
    });
    expect(aggregate).toHaveBeenCalledWith("g", from, to, "5m");
  });
});

describe("GET /api/readings", () => {
  const url =
    "/api/readings?deviceId=g&from=2026-11-01T00:00:00Z&to=2026-11-01T01:00:00Z&bucket=5m";
  async function app() {
    vi.resetModules();
    vi.doMock("./readings.repository.js", () => ({ aggregate: async () => [] }));
    const { readingsRouter: router } = await import("./readings.routes.js");
    const { errorHandler } = await import("../../core/http/error-handler.js");
    const a = express();
    a.use("/api", router);
    a.use(errorHandler);
    return a;
  }

  it("responde 401 sem sessão", async () => {
    expect((await request(await app()).get(url)).status).toBe(401);
  });

  it("responde 400 com parâmetros inválidos", async () => {
    const res = await request(await app())
      .get("/api/readings?deviceId=g&bucket=30m")
      .set("Cookie", `session=${signSession("u-1")}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("responde 200 com a série vazia", async () => {
    const res = await request(await app())
      .get(url)
      .set("Cookie", `session=${signSession("u-1")}`);
    expect(res.status).toBe(200);
    expect(res.body.points).toEqual([]);
  });
});
