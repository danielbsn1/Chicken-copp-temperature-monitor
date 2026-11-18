import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { errorHandler } from "./error-handler.js";
import { requireDevice, requireUser, SESSION_COOKIE } from "./guards.js";
import { signSession } from "../session.js";

function buildApp() {
  const app = express();
  app.get("/me", requireUser, (_req, res) => {
    res.json({ userId: res.locals.userId });
  });
  app.get(
    "/device",
    requireDevice(async (key) => (key === "chave-boa" ? { id: "dev-1" } : null)),
    (_req, res) => {
      res.json({ deviceId: res.locals.deviceId });
    },
  );
  app.use(errorHandler);
  return app;
}

describe("requireUser", () => {
  it("aceita o cookie de sessão válido entre outros cookies", async () => {
    const res = await request(buildApp())
      .get("/me")
      .set("Cookie", `x=1; ${SESSION_COOKIE}=${signSession("u-9")}; y=2`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ userId: "u-9" });
  });

  it.each([
    [undefined],
    ["outro=1"],
    [`${SESSION_COOKIE}=adulterado.xx`],
    [`${SESSION_COOKIE}=`],
  ])("responde 401 (%s)", async (cookie) => {
    const req = request(buildApp()).get("/me");
    const res = await (cookie ? req.set("Cookie", cookie) : req);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });
});

describe("requireDevice", () => {
  it("aceita a chave conhecida e expõe o deviceId", async () => {
    const res = await request(buildApp()).get("/device").set("X-Device-Key", "chave-boa");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ deviceId: "dev-1" });
  });

  it.each([[undefined], ["chave-ruim"]])("responde 401 (%s)", async (key) => {
    const req = request(buildApp()).get("/device");
    const res = await (key ? req.set("X-Device-Key", key) : req);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("não ecoa a chave na resposta de erro", async () => {
    const res = await request(buildApp())
      .get("/device")
      .set("X-Device-Key", "chave-ruim");
    expect(JSON.stringify(res.body)).not.toContain("chave-ruim");
  });
});
