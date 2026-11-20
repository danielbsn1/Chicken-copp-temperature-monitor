import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { signSession } from "../../core/session.js";
import { reportsRouter } from "./index.js";
import { dailyQuery } from "./reports.schemas.js";

describe("módulo reports", () => {
  it("expõe o router pela interface pública", () => {
    expect(typeof reportsRouter).toBe("function");
  });
});

describe("dailyQuery", () => {
  it("aceita dispositivo e dia", () => {
    expect(dailyQuery.safeParse({ deviceId: "g-1", day: "2026-11-14" }).success).toBe(
      true,
    );
  });

  it.each([
    "2026-11-31",
    "2026-02-30",
    "14/11/2026",
    "2026-1-4",
    "",
    "2026-11-14T00:00:00Z",
  ])("recusa o dia %j", (day) => {
    expect(dailyQuery.safeParse({ deviceId: "g-1", day }).success).toBe(false);
  });

  it("aceita 29/02 só em ano bissexto", () => {
    expect(dailyQuery.safeParse({ deviceId: "g", day: "2028-02-29" }).success).toBe(true);
    expect(dailyQuery.safeParse({ deviceId: "g", day: "2027-02-29" }).success).toBe(
      false,
    );
  });

  it("recusa dispositivo inválido ou ausente", () => {
    expect(dailyQuery.safeParse({ deviceId: "G!", day: "2026-11-14" }).success).toBe(
      false,
    );
    expect(dailyQuery.safeParse({ day: "2026-11-14" }).success).toBe(false);
  });
});

const stats = {
  tempMinC: 22.123,
  tempMaxC: 33.987,
  tempAvgC: 27.456789,
  fanOnMinutes: 90,
  readingsCount: 1380,
};

async function load(dayStats: unknown) {
  const upsert = vi.fn(async () => undefined);
  vi.resetModules();
  vi.doMock("../readings/index.js", () => ({ dayStats }));
  vi.doMock("./reports.repository.js", () => ({ upsert }));
  const service = await import("./reports.service.js");
  return { service, upsert };
}

describe("calculateDailySummary", () => {
  it("arredonda a 2 casas e grava com upsert na data do dia", async () => {
    const dayStats = vi.fn(async () => stats);
    const { service, upsert } = await load(dayStats);
    const result = await service.calculateDailySummary({
      deviceId: "g",
      day: "2026-11-14",
    });
    expect(dayStats).toHaveBeenCalledWith("g", "2026-11-14");
    const values = {
      tempMinC: 22.12,
      tempMaxC: 33.99,
      tempAvgC: 27.46,
      fanOnMinutes: 90,
      readingsCount: 1380,
    };
    expect(upsert).toHaveBeenCalledWith("g", new Date("2026-11-14T00:00:00Z"), values);
    expect(result).toEqual({ deviceId: "g", day: "2026-11-14", ...values });
  });

  it("recalcular o mesmo dia regrava o mesmo resultado", async () => {
    const { service, upsert } = await load(vi.fn(async () => stats));
    const first = await service.calculateDailySummary({
      deviceId: "g",
      day: "2026-11-14",
    });
    const second = await service.calculateDailySummary({
      deviceId: "g",
      day: "2026-11-14",
    });
    expect(second).toEqual(first);
    expect(upsert.mock.calls[1]).toEqual(upsert.mock.calls[0]);
  });

  it("dia sem leituras não grava nada", async () => {
    const { service, upsert } = await load(vi.fn(async () => null));
    expect(
      await service.calculateDailySummary({ deviceId: "g", day: "2026-11-14" }),
    ).toBeNull();
    expect(upsert).not.toHaveBeenCalled();
  });
});

describe("GET /api/reports/daily", () => {
  const url = "/api/reports/daily?deviceId=g&day=2026-11-14";
  const cookie = `session=${signSession("u-1")}`;

  async function app(dayStats: unknown) {
    await load(dayStats);
    const { reportsRouter } = await import("./index.js");
    const { errorHandler } = await import("../../core/http/error-handler.js");
    const server = express();
    server.use("/api", reportsRouter);
    server.use(errorHandler);
    return server;
  }

  it("exige sessão", async () => {
    const res = await request(await app(vi.fn(async () => stats))).get(url);
    expect(res.status).toBe(401);
  });

  it("dia inválido responde 400 no formato padrão", async () => {
    const res = await request(await app(vi.fn()))
      .get("/api/reports/daily?deviceId=g&day=2026-02-30")
      .set("Cookie", cookie);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("responde 200 com o resumo", async () => {
    const res = await request(await app(vi.fn(async () => stats)))
      .get(url)
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      deviceId: "g",
      day: "2026-11-14",
      tempMinC: 22.12,
      tempMaxC: 33.99,
      tempAvgC: 27.46,
      fanOnMinutes: 90,
      readingsCount: 1380,
    });
  });

  it("dia sem leituras responde 404 NOT_FOUND", async () => {
    const res = await request(await app(vi.fn(async () => null)))
      .get(url)
      .set("Cookie", cookie);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});
