import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { env } from "../../config/env.js";
import { ForbiddenError } from "../errors.js";
import { errorHandler, notFoundHandler } from "./error-handler.js";
import { requireCronSecret } from "./guards.js";
import { requestId } from "./request-id.js";
import { validate } from "./validate.js";

function buildApp() {
  const app = express();
  app.use(requestId);
  app.use(express.json());
  app.post(
    "/items",
    validate({
      body: z.object({ name: z.string().min(1) }),
      query: z.object({ n: z.coerce.number() }),
    }),
    (req, res) => {
      res.json({ body: req.body, n: req.query.n });
    },
  );
  app.get("/cron", requireCronSecret, (_req, res) => {
    res.json({ ok: true });
  });
  app.get("/forbidden", () => {
    throw new ForbiddenError();
  });
  app.get("/boom", () => {
    throw new Error("segredo-interno-123");
  });
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

describe("request-id", () => {
  it("gera um id quando não vem nenhum", async () => {
    const res = await request(buildApp()).get("/nada");
    expect(res.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("repassa um id válido e troca um inválido", async () => {
    const ok = await request(buildApp()).get("/nada").set("X-Request-Id", "abc-123");
    expect(ok.headers["x-request-id"]).toBe("abc-123");
    const bad = await request(buildApp())
      .get("/nada")
      .set("X-Request-Id", "id com espaço");
    expect(bad.headers["x-request-id"]).not.toBe("id com espaço");
  });
});

describe("validate", () => {
  it("deixa passar e entrega os dados já convertidos", async () => {
    const res = await request(buildApp()).post("/items?n=5").send({ name: "ovo" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ body: { name: "ovo" }, n: 5 });
  });

  it("responde 400 com os detalhes", async () => {
    const res = await request(buildApp()).post("/items?n=abc").send({ name: "" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details.length).toBeGreaterThanOrEqual(2);
  });
});

describe("requireCronSecret", () => {
  it("aceita o segredo correto", async () => {
    const res = await request(buildApp())
      .get("/cron")
      .set("Authorization", `Bearer ${env.CRON_SECRET}`);
    expect(res.status).toBe(200);
  });

  it.each([[undefined], ["Bearer errado"], ["Basic abc"], ["Bearer "]])(
    "rejeita com 401 (%s)",
    async (header) => {
      const req = request(buildApp()).get("/cron");
      const res = await (header ? req.set("Authorization", header) : req);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    },
  );
});

describe("error-handler", () => {
  it("converte AppError no formato padrão", async () => {
    const res = await request(buildApp()).get("/forbidden");
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: { code: "FORBIDDEN", message: "Acesso negado" } });
  });

  it("rota inexistente vira 404", async () => {
    const res = await request(buildApp()).get("/nada");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("erro não previsto vira 500 sem expor o detalhe", async () => {
    const res = await request(buildApp()).get("/boom");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: { code: "INTERNAL_ERROR", message: "Erro interno" },
    });
    expect(JSON.stringify(res.body)).not.toContain("segredo-interno");
  });
});

describe("error-handler: registro e outros erros", () => {
  function appWith(thrower: () => never, logged: unknown[]) {
    const app = express();
    app.use((req, _res, next) => {
      (req as unknown as { log: unknown }).log = {
        error: (...a: unknown[]) => logged.push(["error", ...a]),
        warn: (...a: unknown[]) => logged.push(["warn", ...a]),
      };
      next();
    });
    app.get("/x", thrower);
    app.use(errorHandler);
    return app;
  }

  it("registra erro previsto 4xx como warn", async () => {
    const logged: unknown[] = [];
    await request(
      appWith(() => {
        throw new ForbiddenError();
      }, logged),
    ).get("/x");
    expect(logged).toHaveLength(1);
    expect((logged[0] as unknown[])[0]).toBe("warn");
  });

  it("registra erro não previsto como error, com o detalhe só no log", async () => {
    const logged: unknown[] = [];
    const res = await request(
      appWith(() => {
        throw new Error("detalhe-interno");
      }, logged),
    ).get("/x");
    expect((logged[0] as unknown[])[0]).toBe("error");
    expect(JSON.stringify(res.body)).not.toContain("detalhe-interno");
  });

  it("ZodError vira 400 com details", async () => {
    const res = await request(
      appWith(() => {
        z.object({ a: z.string() }).parse({});
        throw new Error("inalcançável");
      }, []),
    ).get("/x");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details[0].path).toBe("a");
  });

  it("corpo maior que 100 KB vira 413 e JSON malformado vira 400", async () => {
    const app = express();
    app.use(express.json({ limit: "100kb" }));
    app.post("/x", (_req, res) => res.json({}));
    app.use(errorHandler);
    const big = await request(app)
      .post("/x")
      .send({ a: "x".repeat(110_000) });
    expect(big.status).toBe(413);
    const bad = await request(app)
      .post("/x")
      .set("Content-Type", "application/json")
      .send("{oops");
    expect(bad.status).toBe(400);
    expect(bad.body.error.message).toBe("JSON inválido");
  });
});
