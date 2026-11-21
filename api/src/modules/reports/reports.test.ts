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

async function load(dayStats: unknown, row: unknown = null) {
  const upsert = vi.fn(async () => undefined);
  const find = vi.fn(async () => row);
  vi.resetModules();
  vi.doMock("../readings/index.js", () => ({ dayStats }));
  vi.doMock("./reports.repository.js", () => ({ upsert, find }));
  const service = await import("./reports.service.js");
  return { service, upsert, find };
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

const stored = {
  tempMinC: 22.120000839233398, // float4 do banco
  tempMaxC: 33.99,
  tempAvgC: 27.46,
  fanOnMinutes: 90,
  readingsCount: 1380,
};

describe("dailySummary (lê o resumo já gravado)", () => {
  it("devolve o resumo gravado, sem recalcular, e limpa o ruído do float4", async () => {
    const { service, find, upsert } = await load(vi.fn(), stored);
    const result = await service.dailySummary({ deviceId: "g", day: "2026-11-14" });
    expect(find).toHaveBeenCalledWith("g", new Date("2026-11-14T00:00:00Z"));
    expect(upsert).not.toHaveBeenCalled();
    expect(result.tempMinC).toBe(22.12);
    expect(result).toMatchObject({
      deviceId: "g",
      day: "2026-11-14",
      readingsCount: 1380,
    });
  });

  it("sem resumo gravado lança 404", async () => {
    const { service } = await load(vi.fn(), null);
    await expect(
      service.dailySummary({ deviceId: "g", day: "2026-11-14" }),
    ).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });
});

describe("summaryToCsv", () => {
  it("tem BOM, cabeçalho com unidades e uma linha de dados, com CRLF", async () => {
    const { service } = await load(vi.fn());
    const csv = service.summaryToCsv({
      deviceId: "g",
      day: "2026-11-14",
      tempMinC: 22.12,
      tempMaxC: 33.99,
      tempAvgC: 27.46,
      fanOnMinutes: 90,
      readingsCount: 1380,
    });
    expect(csv).toBe(
      "\uFEFFDia,Temperatura mínima (°C),Temperatura máxima (°C),Temperatura média (°C),Ventilador ligado (min),Leituras\r\n" +
        "2026-11-14,22.12,33.99,27.46,90,1380\r\n",
    );
  });
});

describe("GET /api/reports/daily", () => {
  const url = "/api/reports/daily?deviceId=g&day=2026-11-14";
  const cookie = `session=${signSession("u-1")}`;

  async function app(row: unknown) {
    await load(vi.fn(), row);
    const { reportsRouter } = await import("./index.js");
    const { errorHandler } = await import("../../core/http/error-handler.js");
    const server = express();
    server.use("/api", reportsRouter);
    server.use(errorHandler);
    return server;
  }

  it("exige sessão", async () => {
    const res = await request(await app(stored)).get(url);
    expect(res.status).toBe(401);
  });

  it.each([
    ["dia inexistente", "day=2026-02-30"],
    ["format desconhecido", "day=2026-11-14&format=xml"],
  ])("%s responde 400 no formato padrão", async (_nome, query) => {
    const res = await request(await app(stored))
      .get(`/api/reports/daily?deviceId=g&${query}`)
      .set("Cookie", cookie);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details.length).toBeGreaterThan(0);
  });

  it("responde 200 JSON com o resumo (formato padrão)", async () => {
    const res = await request(await app(stored))
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

  it("format=csv baixa o arquivo com tipo, nome e cabeçalho", async () => {
    const res = await request(await app(stored))
      .get(`${url}&format=csv`)
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("text/csv; charset=utf-8");
    expect(res.headers["content-disposition"]).toContain(
      "attachment; filename=resumo-g-2026-11-14.csv",
    );
    expect(res.text).toContain("Temperatura mínima (°C)");
    expect(res.text).toContain("2026-11-14,22.12,33.99,27.46,90,1380");
  });

  it("sem resumo gravado responde 404 NOT_FOUND (json e csv)", async () => {
    for (const q of ["", "&format=csv"]) {
      const res = await request(await app(null))
        .get(`${url}${q}`)
        .set("Cookie", cookie);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    }
  });
});
