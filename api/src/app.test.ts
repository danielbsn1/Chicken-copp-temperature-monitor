import request from "supertest";
import { describe, expect, it } from "vitest";
import { env } from "./config/env.js";
import { createApp } from "./app.js";

const app = createApp();

describe("GET /api/health", () => {
  it("responde 200 com status ok, sem autenticação", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});

describe("createApp", () => {
  it("aplica o helmet", async () => {
    const res = await request(app).get("/api/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("devolve o X-Request-Id", async () => {
    const res = await request(app).get("/api/health").set("X-Request-Id", "teste-1");
    expect(res.headers["x-request-id"]).toBe("teste-1");
  });

  it("libera o CORS, com cookies, só para a origem do painel", async () => {
    const ok = await request(app).get("/api/health").set("Origin", env.WEB_ORIGIN);
    expect(ok.headers["access-control-allow-origin"]).toBe(env.WEB_ORIGIN);
    expect(ok.headers["access-control-allow-credentials"]).toBe("true");

    const other = await request(app)
      .get("/api/health")
      .set("Origin", "https://outro.com");
    expect(other.headers["access-control-allow-origin"]).not.toBe("https://outro.com");
  });

  it("rejeita corpo maior que 100 KB no formato padrão", async () => {
    const res = await request(app)
      .post("/api/health")
      .send({ dados: "x".repeat(101 * 1024) });
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("rejeita JSON malformado com 400", async () => {
    const res = await request(app)
      .post("/api/health")
      .set("Content-Type", "application/json")
      .send("{ruim");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rota inexistente responde 404 no formato padrão", async () => {
    const res = await request(app).get("/api/nao-existe");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { code: "NOT_FOUND", message: "Recurso não encontrado" },
    });
  });
});
