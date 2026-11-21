import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { describe, expect, it } from "vitest";
import { API, server } from "../shared/test/server";
import { createQueryClient } from "./query-client";
import { routes } from "./routes";

function renderApp(route: string) {
  const router = createMemoryRouter(routes, { initialEntries: [route] });
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

const device = (id: string, name: string) => ({
  id,
  name,
  lastSeenAt: null,
  fwVersion: null,
});
const found = (serial = "AVT-0001-XYZ") => ({
  devices: [
    {
      serial,
      fwVersion: "2.0.1",
      expiresAt: "2026-11-21T12:05:00.000Z",
      ticket: "123.tkt",
    },
  ],
});

function devices(list: ReturnType<typeof device>[]) {
  server.use(http.get(`${API}/devices`, () => HttpResponse.json({ devices: list })));
}
function available(body: {
  devices: {
    serial: string;
    fwVersion: string;
    expiresAt: string | null;
    ticket: string | null;
  }[];
}) {
  server.use(http.get(`${API}/pairing/available`, () => HttpResponse.json(body)));
}
function error(status: number, code: string) {
  return HttpResponse.json({ error: { code, message: "x" } }, { status });
}

describe("equipamentos da conta", () => {
  it("as consultas usam o equipamento em uso", async () => {
    const seen: string[] = [];
    server.use(
      http.get(`${API}/status`, ({ request }) => {
        seen.push(new URL(request.url).searchParams.get("deviceId") ?? "");
        return HttpResponse.json({
          reading: null,
          fanOn: null,
          lastSeenAt: null,
          fwVersion: null,
        });
      }),
    );
    devices([device("galinheiro-da-ana-ab12", "Da Ana")]);
    renderApp("/");
    await waitFor(() => expect(seen[0]).toBe("galinheiro-da-ana-ab12"));
  });

  it("com um só equipamento mostra o nome; com vários, um seletor que troca as consultas", async () => {
    const user = userEvent.setup();
    const seen: string[] = [];
    server.use(
      http.get(`${API}/status`, ({ request }) => {
        seen.push(new URL(request.url).searchParams.get("deviceId") ?? "");
        return HttpResponse.json({
          reading: null,
          fanOn: null,
          lastSeenAt: null,
          fwVersion: null,
        });
      }),
    );
    devices([device("g-a", "Galinheiro A"), device("g-b", "Galinheiro B")]);
    renderApp("/");
    const select = await screen.findByRole("combobox", { name: "Galinheiro" });
    expect(select).toHaveValue("g-a");
    await user.selectOptions(select, "g-b");
    await waitFor(() => expect(seen).toContain("g-b"));
  });

  it("um equipamento só: o cabeçalho mostra o nome sem seletor", async () => {
    renderApp("/");
    expect(await screen.findByText("Galinheiro teste")).toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Galinheiro" }),
    ).not.toBeInTheDocument();
  });

  it("conta sem equipamento vai direto para Adicionar equipamento", async () => {
    devices([]);
    available({ devices: [] });
    const router = renderApp("/relatorios");
    expect(
      await screen.findByRole("heading", { name: "Adicionar equipamento", level: 1 }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/equipamentos/novo");
  });

  it("falha ao carregar a lista mostra erro com 'Tentar de novo'", async () => {
    server.use(http.get(`${API}/devices`, () => error(500, "INTERNAL")));
    renderApp("/");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar seus equipamentos.",
    );
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
  });
});

describe("Adicionar equipamento (logado)", () => {
  it("sem equipamento na rede mostra que está procurando", async () => {
    available({ devices: [] });
    renderApp("/equipamentos/novo");
    expect(await screen.findByText(/Procurando equipamentos/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Vincular equipamento" })).toBeDisabled();
  });

  it("acha o equipamento, pede o nome e vincula; depois abre o painel com o novo", async () => {
    const user = userEvent.setup();
    available(found());
    let body: unknown;
    server.use(
      http.post(`${API}/pairing/claim`, async ({ request }) => {
        body = await request.json();
        devices([
          device("galinheiro-teste", "Galinheiro teste"),
          device("novo-ab12", "Novo"),
        ]);
        return HttpResponse.json(
          { deviceId: "novo-ab12", name: "Novo" },
          { status: 201 },
        );
      }),
    );
    renderApp("/equipamentos/novo");
    const radio = await screen.findByRole("radio", { name: /AVT-0001-XYZ/ });
    expect(radio).toBeChecked(); // um só na rede já vem escolhido
    await user.type(screen.getByLabelText("Nome do galinheiro"), "Novo");
    await user.click(screen.getByRole("button", { name: "Vincular equipamento" }));
    await waitFor(() =>
      expect(body).toEqual({
        serial: "AVT-0001-XYZ",
        name: "Novo",
        manual: false,
        ticket: "123.tkt",
      }),
    );
    expect(await screen.findByRole("heading", { name: "Painel" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Galinheiro" })).toHaveValue("novo-ab12");
  });

  it("digitar o serial da etiqueta envia manual: true", async () => {
    const user = userEvent.setup();
    available({ devices: [] });
    let body: unknown;
    server.use(
      http.post(`${API}/pairing/claim`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ deviceId: "x-1234", name: "X" }, { status: 201 });
      }),
    );
    renderApp("/equipamentos/novo");
    await user.click(
      await screen.findByRole("button", { name: /Digite o serial da etiqueta/ }),
    );
    await user.type(screen.getByLabelText("Serial da etiqueta"), " AVT-0002-ABC ");
    await user.type(screen.getByLabelText("Nome do galinheiro"), "X");
    await user.click(screen.getByRole("button", { name: "Vincular equipamento" }));
    await waitFor(() =>
      expect(body).toEqual({ serial: "AVT-0002-ABC", name: "X", manual: true }),
    );
  });

  it.each([
    [409, "PAIRING_CLOSED", "Aperte o botão de pareamento"],
    [404, "NOT_FOUND", "Equipamento não encontrado"],
    [429, "RATE_LIMITED", "Muitas tentativas"],
  ])("erro %i (%s) mostra a mensagem para o produtor", async (status, code, text) => {
    const user = userEvent.setup();
    available(found());
    server.use(http.post(`${API}/pairing/claim`, () => error(status, code)));
    renderApp("/equipamentos/novo");
    await screen.findByRole("radio", { name: /AVT-0001-XYZ/ });
    await user.type(screen.getByLabelText("Nome do galinheiro"), "Novo");
    await user.click(screen.getByRole("button", { name: "Vincular equipamento" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(text);
  });

  it("com vários na rede é preciso escolher um", async () => {
    const user = userEvent.setup();
    available({
      devices: [
        { serial: "AVT-0001-AAA", fwVersion: "2.0.1", expiresAt: null, ticket: null },
        { serial: "AVT-0002-BBB", fwVersion: "2.0.1", expiresAt: null, ticket: null },
      ],
    });
    renderApp("/equipamentos/novo");
    await screen.findByRole("radio", { name: /AVT-0002-BBB/ });
    await user.type(screen.getByLabelText("Nome do galinheiro"), "Novo");
    expect(screen.getByRole("button", { name: "Vincular equipamento" })).toBeDisabled();
    await user.click(screen.getByRole("radio", { name: /AVT-0002-BBB/ }));
    expect(screen.getByRole("button", { name: "Vincular equipamento" })).toBeEnabled();
  });
});

describe("Primeiro acesso (/cadastro)", () => {
  function noSession() {
    server.use(http.get(`${API}/auth/me`, () => error(401, "UNAUTHORIZED")));
  }

  it("o login tem o link para o primeiro acesso", async () => {
    noSession();
    renderApp("/login");
    expect(
      await screen.findByRole("link", { name: "Cadastre seu equipamento" }),
    ).toHaveAttribute("href", "/cadastro");
  });

  it("cria a conta, entra e abre o painel", async () => {
    const user = userEvent.setup();
    noSession();
    available(found());
    const calls: string[] = [];
    let signup: unknown;
    server.use(
      http.post(`${API}/pairing/signup`, async ({ request }) => {
        calls.push("signup");
        signup = await request.json();
        return HttpResponse.json(
          { deviceId: "novo-ab12", name: "Novo" },
          { status: 201 },
        );
      }),
      http.post(`${API}/auth/login`, () => {
        calls.push("login");
        // depois do login a sessão passa a existir
        server.use(
          http.get(`${API}/auth/me`, () =>
            HttpResponse.json({ id: "u9", email: "ana@example.com" }),
          ),
        );
        return HttpResponse.json({ id: "u9", email: "ana@example.com" });
      }),
    );
    renderApp("/cadastro");
    await screen.findByRole("radio", { name: /AVT-0001-XYZ/ });
    await user.type(screen.getByLabelText("Nome do galinheiro"), "Novo");
    await user.type(screen.getByLabelText("E-mail"), "ana@example.com");
    await user.type(screen.getByLabelText(/^Senha/), "senha-bem-longa-1");
    await user.click(screen.getByRole("button", { name: "Criar conta e vincular" }));
    expect(await screen.findByRole("heading", { name: "Painel" })).toBeInTheDocument();
    expect(calls).toEqual(["signup", "login"]);
    expect(signup).toEqual({
      serial: "AVT-0001-XYZ",
      name: "Novo",
      manual: false,
      email: "ana@example.com",
      password: "senha-bem-longa-1",
      ticket: "123.tkt",
    });
  });

  it("e-mail que já existe responde 409 com a mensagem e não entra", async () => {
    const user = userEvent.setup();
    noSession();
    available(found());
    server.use(http.post(`${API}/pairing/signup`, () => error(409, "CONFLICT")));
    renderApp("/cadastro");
    await screen.findByRole("radio", { name: /AVT-0001-XYZ/ });
    await user.type(screen.getByLabelText("Nome do galinheiro"), "Novo");
    await user.type(screen.getByLabelText("E-mail"), "ana@example.com");
    await user.type(screen.getByLabelText(/^Senha/), "senha-bem-longa-1");
    await user.click(screen.getByRole("button", { name: "Criar conta e vincular" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Este e-mail já tem conta",
    );
    expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("a página de cadastro é pública: não redireciona para o login", async () => {
    noSession();
    available({ devices: [] });
    renderApp("/cadastro");
    const page = await screen.findByRole("heading", { name: "Primeiro acesso" });
    expect(within(page.parentElement!).getByText(/Procurando/)).toBeInTheDocument();
  });
});
