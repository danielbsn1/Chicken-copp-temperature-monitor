import { http, HttpResponse } from "msw";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes, useLocation } from "react-router";
import { describe, expect, it } from "vitest";
import { API, server } from "../../shared/test/server";
import { renderWithProviders } from "../../shared/test/render";
import { LoginPage, RequireAuth } from "./index";
import { safeNext } from "./auth.hooks";

function Where() {
  const location = useLocation();
  return <p>local: {location.pathname + location.search}</p>;
}

function Tree() {
  return (
    <Routes>
      <Route path="/login" element={<Where />} />
      <Route element={<RequireAuth />}>
        <Route path="/" element={<p>área privada</p>} />
        <Route path="/relatorios" element={<p>relatórios</p>} />
      </Route>
    </Routes>
  );
}

describe("RequireAuth", () => {
  it("mostra o carregamento e depois a área privada quando há sessão", async () => {
    renderWithProviders(<Tree />);
    expect(screen.getByRole("status")).toHaveTextContent("Verificando a sessão");
    expect(await screen.findByText("área privada")).toBeInTheDocument();
  });

  it("redireciona para /login?next=<rota> quando a API responde 401", async () => {
    server.use(
      http.get(`${API}/auth/me`, () =>
        HttpResponse.json(
          { error: { code: "UNAUTHORIZED", message: "Não autenticado" } },
          { status: 401 },
        ),
      ),
    );
    renderWithProviders(<Tree />, { route: "/relatorios" });
    expect(
      await screen.findByText("local: /login?next=%2Frelatorios"),
    ).toBeInTheDocument();
  });

  it("mostra erro com 'Tentar de novo' em falha de servidor", async () => {
    server.use(
      http.get(`${API}/auth/me`, () =>
        HttpResponse.json(
          { error: { code: "INTERNAL_ERROR", message: "Erro interno" } },
          { status: 500 },
        ),
      ),
    );
    renderWithProviders(<Tree />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível verificar a sessão",
    );
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
  });
});

describe("LoginPage", () => {
  function LoginTree() {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Where />} />
      </Routes>
    );
  }
  const fill = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.type(screen.getByLabelText("E-mail"), "dono@example.com");
    await user.type(screen.getByLabelText("Senha"), "segredo-123");
    await user.click(screen.getByRole("button", { name: "Entrar" }));
  };
  const fail = (status: number) =>
    server.use(
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json({ error: { code: "X", message: "x" } }, { status }),
      ),
    );

  it("tem campos com rótulo e o botão Entrar", () => {
    renderWithProviders(<LoginTree />, { route: "/login" });
    expect(screen.getByLabelText("E-mail")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Senha")).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
  });

  it("entra e volta à rota de origem, sem guardar nada no navegador", async () => {
    server.use(
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json({ id: "u1", email: "dono@example.com" }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<LoginTree />, { route: "/login?next=%2Frelatorios" });
    await fill(user);
    expect(await screen.findByText("local: /relatorios")).toBeInTheDocument();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it("sem next, vai para /", async () => {
    server.use(
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json({ id: "u1", email: "dono@example.com" }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<LoginTree />, { route: "/login" });
    await fill(user);
    expect(await screen.findByText("local: /")).toBeInTheDocument();
  });

  it.each([
    [401, "E-mail ou senha inválidos"],
    [429, "Muitas tentativas. Tente de novo em 15 minutos."],
  ])("erro %i mostra a mensagem", async (status, message) => {
    fail(status);
    const user = userEvent.setup();
    renderWithProviders(<LoginTree />, { route: "/login" });
    await fill(user);
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
  });

  it("falha de rede mostra 'Sem conexão com o servidor'", async () => {
    server.use(http.post(`${API}/auth/login`, () => HttpResponse.error()));
    const user = userEvent.setup();
    renderWithProviders(<LoginTree />, { route: "/login" });
    await fill(user);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Sem conexão com o servidor",
    );
  });
});

describe("safeNext", () => {
  it.each([
    ["/relatorios", "/relatorios"],
    ["/relatorios?a=1", "/relatorios?a=1"],
    [null, "/"],
    ["", "/"],
    ["https://mal.example", "/"],
    ["//mal.example", "/"],
    ["/login", "/"],
    ["/login?next=%2F", "/"],
  ])("%s -> %s", (input, expected) => {
    expect(safeNext(input)).toBe(expected);
  });
});
