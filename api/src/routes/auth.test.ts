import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { hashPassword } from "../lib/password.js";
import { prisma } from "../lib/prisma.js";

const EMAIL = "teste-auth@example.com";
const PASSWORD = "senha-de-teste-123";

describe("POST /api/auth/login", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  const login = (password: string, email = EMAIL) =>
    app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password },
    });

  async function clean() {
    await prisma().loginAttempt.deleteMany({ where: { key: EMAIL } });
  }

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    await prisma().user.upsert({
      where: { email: EMAIL },
      create: { email: EMAIL, passwordHash: await hashPassword(PASSWORD) },
      update: { passwordHash: await hashPassword(PASSWORD) },
    });
  });

  beforeEach(clean);

  afterAll(async () => {
    await clean();
    await prisma().user.delete({ where: { email: EMAIL } });
    await app.close();
    await prisma().$disconnect();
  });

  it("abre a sessão com cookie httpOnly", async () => {
    const res = await login(PASSWORD);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    const cookie = res.headers["set-cookie"];
    expect(String(cookie)).toContain("session=");
    expect(String(cookie)).toContain("HttpOnly");
  });

  it("rejeita senha errada com 401", async () => {
    const res = await login("senha-errada");
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe("unauthorized");
  });

  it("rejeita e-mail inexistente com a mesma resposta", async () => {
    const res = await login(PASSWORD, "ninguem@example.com");
    expect(res.statusCode).toBe(401);
    expect(res.json().error.message).toBe("Credenciais inválidas");
    await prisma().loginAttempt.deleteMany({
      where: { key: "ninguem@example.com" },
    });
  });

  it("bloqueia com 429 depois de 5 tentativas erradas", async () => {
    for (let i = 0; i < 5; i++) await login("errada");
    const res = await login(PASSWORD);
    expect(res.statusCode).toBe(429);
  });
});

describe("POST /api/auth/logout", () => {
  it("limpa o cookie", async () => {
    const app = await buildApp();
    await app.ready();
    const res = await app.inject({ method: "POST", url: "/api/auth/logout" });
    expect(res.statusCode).toBe(200);
    expect(String(res.headers["set-cookie"])).toContain("session=;");
    await app.close();
  });
});
