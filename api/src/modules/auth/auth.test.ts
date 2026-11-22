import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../../core/http/error-handler.js";
import { SESSION_COOKIE } from "../../core/http/guards.js";
import { signSession, verifySession } from "../../core/session.js";

interface UserRow {
  id: string;
  email: string;
  passwordHash: string;
}

const db = vi.hoisted(() => ({
  users: [] as unknown[],
  attempts: [] as { key: string; at: Date }[],
}));
const users = db.users as UserRow[];

vi.mock("./auth.repository.js", () => ({
  findUserByEmail: async (email: string) => users.find((u) => u.email === email) ?? null,
  findUserById: async (id: string) => users.find((u) => u.id === id) ?? null,
  saveUser: async (email: string, passwordHash: string) => {
    const old = users.find((u) => u.email === email);
    if (old) {
      old.passwordHash = passwordHash;
      return { id: old.id, created: false };
    }
    users.push({ id: `id-${users.length + 1}`, email, passwordHash });
    return { id: `id-${users.length}`, created: true };
  },
  countFailures: async (key: string, since: Date) =>
    db.attempts.filter((a) => a.key === key && a.at > since).length,
  addFailure: async (key: string, at: Date) => {
    db.attempts.push({ key, at });
  },
  clearFailures: async (key: string) => {
    db.attempts = db.attempts.filter((a) => a.key !== key);
  },
}));

vi.mock("./password.js", async (original) => {
  const actual = await original<typeof import("./password.js")>();
  return { ...actual, verifyPassword: vi.fn(actual.verifyPassword) };
});

const password = await import("./password.js");
const { login, getUser, registerUser, MOCK_USER } = await import("./auth.service.js");
const { authRouter } = await import("./index.js");

const NOW = new Date("2026-11-18T12:00:00Z");
const minutesBefore = (m: number) => new Date(NOW.getTime() - m * 60_000);
const EMAIL = "dono@galinheiro.com";
const SENHA = "senha-do-produtor-123";

beforeEach(async () => {
  users.length = 0;
  db.attempts = [];
  vi.mocked(password.verifyPassword).mockClear();
  users.push({
    id: "u-1",
    email: EMAIL,
    passwordHash: await password.hashPassword(SENHA),
  });
});

describe("login", () => {
  it("credenciais corretas devolvem id e email", async () => {
    expect(await login(EMAIL, SENHA, NOW)).toEqual({ id: "u-1", email: EMAIL });
  });

  it("senha errada: 401 e registra a falha", async () => {
    await expect(login(EMAIL, "errada-errada-1", NOW)).rejects.toMatchObject({
      status: 401,
    });
    expect(db.attempts).toHaveLength(1);
    expect(db.attempts[0]?.key).toBe(EMAIL);
  });

  it("e-mail inexistente: mesmo 401 e mesma mensagem, e confere contra um hash falso", async () => {
    const wrong = await login(EMAIL, "errada-errada-1", NOW).catch((e: Error) => e);
    vi.mocked(password.verifyPassword).mockClear();
    const unknown = await login("ninguem@x.com", SENHA, NOW).catch((e: Error) => e);
    expect(unknown).toMatchObject({ status: 401, code: "UNAUTHORIZED" });
    expect((unknown as Error).message).toBe((wrong as Error).message);
    expect(password.verifyPassword).toHaveBeenCalledTimes(1);
    expect(db.attempts.at(-1)?.key).toBe("ninguem@x.com");
  });

  it("e-mail em maiúsculas e com espaços entra do mesmo jeito", async () => {
    expect(await login("  DONO@Galinheiro.COM ", SENHA, NOW)).toMatchObject({
      id: "u-1",
    });
  });

  it("a 6ª tentativa depois de 5 falhas em 15 min responde 429, até com a senha certa", async () => {
    for (let i = 0; i < 5; i++) {
      await expect(login(EMAIL, "errada-errada-1", NOW)).rejects.toMatchObject({
        status: 401,
      });
    }
    await expect(login(EMAIL, SENHA, NOW)).rejects.toMatchObject({
      status: 429,
      code: "RATE_LIMITED",
    });
  });

  it("o bloqueio não conta as tentativas bloqueadas (não se prorroga sozinho)", async () => {
    for (let i = 0; i < 5; i++)
      await login(EMAIL, "errada-errada-1", NOW).catch(() => {});
    await login(EMAIL, SENHA, NOW).catch(() => {});
    expect(db.attempts).toHaveLength(5);
  });

  it("4 falhas ainda deixam entrar", async () => {
    for (let i = 0; i < 4; i++)
      await login(EMAIL, "errada-errada-1", NOW).catch(() => {});
    expect(await login(EMAIL, SENHA, NOW)).toMatchObject({ id: "u-1" });
  });

  it("falhas com mais de 15 min não contam", async () => {
    for (let i = 0; i < 5; i++) db.attempts.push({ key: EMAIL, at: minutesBefore(16) });
    expect(await login(EMAIL, SENHA, NOW)).toMatchObject({ id: "u-1" });
  });

  it("falhas de 14 min atrás ainda contam", async () => {
    for (let i = 0; i < 5; i++) db.attempts.push({ key: EMAIL, at: minutesBefore(14) });
    await expect(login(EMAIL, SENHA, NOW)).rejects.toMatchObject({ status: 429 });
  });

  it("o login com sucesso zera as falhas", async () => {
    await login(EMAIL, "errada-errada-1", NOW).catch(() => {});
    await login(EMAIL, SENHA, NOW);
    expect(db.attempts).toHaveLength(0);
  });

  it("as falhas de um e-mail não bloqueiam outro", async () => {
    for (let i = 0; i < 5; i++) await login("outro@x.com", "x", NOW).catch(() => {});
    expect(await login(EMAIL, SENHA, NOW)).toMatchObject({ id: "u-1" });
  });
});

describe("login mocado", () => {
  it("o usuário de teste entra e é criado no banco", async () => {
    const user = await login(MOCK_USER.email, MOCK_USER.password, NOW);
    expect(user.email).toBe(MOCK_USER.email);
    expect(users.some((u) => u.email === MOCK_USER.email)).toBe(true);
  });
});

describe("getUser", () => {
  it("devolve id e email, nunca o hash", async () => {
    expect(await getUser("u-1")).toEqual({ id: "u-1", email: EMAIL });
  });

  it("usuário que não existe mais: 401", async () => {
    await expect(getUser("sumiu")).rejects.toMatchObject({ status: 401 });
  });
});

describe("registerUser", () => {
  it("cadastra com e-mail em minúsculas e guarda só o hash scrypt", async () => {
    const result = await registerUser("  Novo@Galinheiro.COM ", "outra-senha-forte-1");
    expect(result).toEqual({ created: true, email: "novo@galinheiro.com" });
    const row = users.find((u) => u.email === "novo@galinheiro.com");
    expect(row?.passwordHash).toMatch(/^scrypt\$/);
    expect(JSON.stringify(users)).not.toContain("outra-senha-forte-1");
  });

  it("para e-mail já cadastrado troca a senha", async () => {
    const result = await registerUser(EMAIL, "senha-nova-bem-forte-1");
    expect(result.created).toBe(false);
    expect(await login(EMAIL, "senha-nova-bem-forte-1", NOW)).toMatchObject({
      id: "u-1",
    });
  });

  it.each([["curta"], ["12345678901"]])(
    "recusa senha com menos de 12 caracteres (%s)",
    async (s) => {
      await expect(registerUser("x@y.com", s)).rejects.toMatchObject({ status: 400 });
    },
  );

  it("recusa e-mail inválido", async () => {
    await expect(
      registerUser("nao-e-email", "senha-forte-demais-1"),
    ).rejects.toMatchObject({
      status: 400,
    });
  });
});

describe("rotas /api/auth", () => {
  const app = () => {
    const a = express();
    a.use(express.json());
    a.use("/api", authRouter);
    a.use(errorHandler);
    return a;
  };
  const login_ = (body: object) => request(app()).post("/api/auth/login").send(body);
  const cookieOf = (res: request.Response) =>
    ((res.headers["set-cookie"] as unknown as string[] | undefined) ?? [])[0] ?? "";

  it("login correto: 200, id e email no corpo e cookie de sessão", async () => {
    const res = await login_({ email: EMAIL, password: SENHA });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: "u-1", email: EMAIL });
    expect(JSON.stringify(res.body)).not.toContain("scrypt");
    expect(cookieOf(res)).toMatch(new RegExp(`^${SESSION_COOKIE}=`));
  });

  it("o cookie é httpOnly, sameSite=lax, válido por 7 dias e assinado", async () => {
    const cookie = cookieOf(await login_({ email: EMAIL, password: SENHA }));
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Max-Age=604800/);
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).not.toMatch(/Secure/i);
    const value = cookie.split(";")[0]!.split("=").slice(1).join("=");
    expect(verifySession(decodeURIComponent(value))).toEqual({ userId: "u-1" });
  });

  it("em produção o cookie é Secure", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    const { authRouter: prodRouter } = await import("./index.js");
    const a = express();
    a.use(express.json());
    a.use("/api", prodRouter);
    a.use(errorHandler);
    const res = await request(a)
      .post("/api/auth/login")
      .send({ email: EMAIL, password: SENHA });
    expect(cookieOf(res)).toMatch(/Secure/i);
    vi.unstubAllEnvs();
  });

  it("credenciais inválidas: 401 no formato padrão, sem cookie e sem revelar o e-mail", async () => {
    const wrong = await login_({ email: EMAIL, password: "errada-errada-1" });
    const unknown = await login_({ email: "ninguem@x.com", password: "errada-errada-1" });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(unknown.body).toEqual(wrong.body);
    expect(wrong.body.error.code).toBe("UNAUTHORIZED");
    expect(cookieOf(wrong)).toBe("");
  });

  it("5 falhas e a seguinte responde 429", async () => {
    for (let i = 0; i < 5; i++)
      await login_({ email: EMAIL, password: "errada-errada-1" });
    const res = await login_({ email: EMAIL, password: SENHA });
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe("RATE_LIMITED");
    expect(cookieOf(res)).toBe("");
  });

  it.each([
    [{}],
    [{ email: "nao-e-email", password: "x" }],
    [{ email: EMAIL }],
    [{ email: EMAIL, password: "" }],
    [{ email: EMAIL, password: "x".repeat(300) }],
  ])("corpo inválido %j: 400 com details", async (body) => {
    const res = await login_(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details.length).toBeGreaterThan(0);
  });

  it("logout: 204 e remove o cookie", async () => {
    const res = await request(app())
      .post("/api/auth/logout")
      .set("Cookie", `${SESSION_COOKIE}=${signSession("u-1")}`);
    expect(res.status).toBe(204);
    const cookie = cookieOf(res);
    expect(cookie).toMatch(new RegExp(`^${SESSION_COOKIE}=;`));
    expect(cookie).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect(cookie).toMatch(/HttpOnly/i);
  });

  it("logout sem sessão: 401", async () => {
    expect((await request(app()).post("/api/auth/logout")).status).toBe(401);
  });

  it("me: 200 com id e email", async () => {
    const res = await request(app())
      .get("/api/auth/me")
      .set("Cookie", `${SESSION_COOKIE}=${signSession("u-1")}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: "u-1", email: EMAIL });
  });

  it.each([
    ["sem cookie", undefined],
    ["cookie adulterado", `${SESSION_COOKIE}=adulterado.xx`],
    ["usuário removido", `${SESSION_COOKIE}=${signSession("sumiu")}`],
  ])("me: 401 (%s)", async (_nome, cookie) => {
    const req = request(app()).get("/api/auth/me");
    const res = await (cookie ? req.set("Cookie", cookie) : req);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("o fluxo completo: login, me com o cookie recebido, logout", async () => {
    const agent = request.agent(app());
    await agent
      .post("/api/auth/login")
      .send({ email: EMAIL, password: SENHA })
      .expect(200);
    await agent.get("/api/auth/me").expect(200);
    await agent.post("/api/auth/logout").expect(204);
    await agent.get("/api/auth/me").expect(401);
  });
});
