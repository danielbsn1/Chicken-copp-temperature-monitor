import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { signSession } from "../../core/session.js";
import { eventsRouter } from "./index.js";

describe("módulo events", () => {
  it("expõe o router pela interface pública", () => {
    expect(typeof eventsRouter).toBe("function");
  });
});

describe("saveMany", () => {
  it("repassa as linhas e a transação e devolve quantas foram gravadas", async () => {
    const createMany = vi.fn(async () => 1);
    vi.resetModules();
    vi.doMock("./events.repository.js", () => ({ createMany }));
    const { saveMany } = await import("./events.service.js");
    const rows = [
      { deviceId: "g", ts: new Date(), type: "boot", detail: { reason: "power_on" } },
    ];
    const tx = { tx: true };
    expect(await saveMany(rows, tx as never)).toBe(1);
    expect(createMany).toHaveBeenCalledWith(rows, tx);
  });
});

describe("listEvents", () => {
  it("devolve os eventos em ISO, na ordem do repositório", async () => {
    const findMany = vi.fn(async () => [
      { ts: new Date("2026-11-01T00:10:00Z"), type: "fan_off", detail: null },
      { ts: new Date("2026-11-01T00:05:00Z"), type: "fan_on", detail: { tempC: 31 } },
    ]);
    vi.resetModules();
    vi.doMock("./events.repository.js", () => ({ findMany }));
    const { listEvents } = await import("./events.service.js");
    const query = { deviceId: "g", limit: 50 };
    expect(await listEvents(query)).toEqual({
      deviceId: "g",
      events: [
        { ts: "2026-11-01T00:10:00.000Z", type: "fan_off", detail: null },
        { ts: "2026-11-01T00:05:00.000Z", type: "fan_on", detail: { tempC: 31 } },
      ],
    });
    expect(findMany).toHaveBeenCalledWith(query);
  });
});

describe("GET /api/events", () => {
  async function app() {
    vi.resetModules();
    vi.doMock("./events.repository.js", () => ({ findMany: async () => [] }));
    const { eventsRouter: router } = await import("./events.routes.js");
    const { errorHandler } = await import("../../core/http/error-handler.js");
    const a = express();
    a.use("/api", router);
    a.use(errorHandler);
    return a;
  }
  const cookie = () => `session=${signSession("u-1")}`;

  it("responde 401 sem sessão", async () => {
    expect((await request(await app()).get("/api/events?deviceId=g")).status).toBe(401);
  });

  it("responde 400 com limit acima de 200", async () => {
    const res = await request(await app())
      .get("/api/events?deviceId=g&limit=201")
      .set("Cookie", cookie());
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("responde 200 com a lista vazia", async () => {
    const res = await request(await app())
      .get("/api/events?deviceId=g")
      .set("Cookie", cookie());
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ deviceId: "g", events: [] });
  });
});
