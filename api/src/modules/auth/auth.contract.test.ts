import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { db } from "../../core/db.js";
import { isDatabaseReady } from "../../test-utils/db-ready.js";
import { registerUser } from "./index.js";

// Login e bloqueio contra um Postgres real (tabelas users e login_attempts).
const dbReady = await isDatabaseReady(() => db.device.count());

const EMAIL = "contrato-auth@galinheiro.test";
const SENHA = "senha-do-contrato-123";

describe.skipIf(!dbReady)("auth (Postgres real)", () => {
  const app = createApp();
  const login = (email: string, password: string) =>
    request(app).post("/api/auth/login").send({ email, password });

  async function clean() {
    await db.loginAttempt.deleteMany({ where: { key: EMAIL } });
    await db.user.deleteMany({ where: { email: EMAIL } });
  }
  beforeAll(async () => {
    await clean();
    await registerUser(EMAIL, SENHA);
  });
  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  it("guarda só o hash scrypt (e o e-mail em minúsculas)", async () => {
    const user = await db.user.findUniqueOrThrow({ where: { email: EMAIL } });
    expect(user.passwordHash).toMatch(/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
    expect(user.passwordHash).not.toContain(SENHA);
  });

  it("5 falhas gravam em login_attempts e a 6ª tentativa recebe 429, até com a senha certa", async () => {
    for (let i = 0; i < 5; i++) {
      expect((await login(EMAIL, "errada-errada-1")).status).toBe(401);
    }
    expect(await db.loginAttempt.count({ where: { key: EMAIL } })).toBe(5);
    const blocked = await login(EMAIL, SENHA);
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("RATE_LIMITED");
    expect(await db.loginAttempt.count({ where: { key: EMAIL } })).toBe(5);
  });

  it("falhas com mais de 15 min saem da conta e o login com sucesso zera as falhas", async () => {
    await db.loginAttempt.updateMany({
      where: { key: EMAIL },
      data: { at: new Date(Date.now() - 16 * 60_000) },
    });
    const ok = await login(EMAIL, SENHA);
    expect(ok.status).toBe(200);
    expect(ok.body.email).toBe(EMAIL);
    expect(await db.loginAttempt.count({ where: { key: EMAIL } })).toBe(0);
  });

  it("o cookie do login abre /me e some no logout", async () => {
    const agent = request.agent(app);
    await agent
      .post("/api/auth/login")
      .send({ email: EMAIL, password: SENHA })
      .expect(200);
    const me = await agent.get("/api/auth/me").expect(200);
    expect(me.body.email).toBe(EMAIL);
    await agent.post("/api/auth/logout").expect(204);
    await agent.get("/api/auth/me").expect(401);
  });
});
