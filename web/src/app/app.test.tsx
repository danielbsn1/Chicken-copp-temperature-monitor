import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { describe, expect, it } from "vitest";
import { API, server } from "../shared/test/server";
import { ConfigErrorPage } from "./pages/ConfigErrorPage";
import { createQueryClient } from "./query-client";
import { App } from "./App";
import { queryClient } from "./query-client";
import { routes } from "./routes";

function renderApp(route: string) {
  const router = createMemoryRouter(routes, { initialEntries: [route] });
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

function sessionExpired() {
  server.use(
    http.get(`${API}/auth/me`, () =>
      HttpResponse.json(
        { error: { code: "UNAUTHORIZED", message: "x" } },
        { status: 401 },
      ),
    ),
  );
}

describe("rotas", () => {
  it("/ mostra o painel só com a situação atual e o gráfico, sem eventos", async () => {
    renderApp("/");
    expect(
      await screen.findByRole("heading", { name: "Painel", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(
      "Os dados chegam em lotes de 15 min.",
    );
    expect(screen.getByRole("heading", { name: "Situação atual" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Temperatura" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Eventos" })).not.toBeInTheDocument();
    expect(screen.queryByText("Todos os eventos", { selector: "h2" })).toBeNull();
  });

  it("/eventos mostra todos os eventos", async () => {
    renderApp("/eventos");
    expect(
      await screen.findByRole("heading", { name: "Eventos", level: 1 }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "Todos os eventos" }),
    ).toBeInTheDocument();
  });

  it("o menu lateral tem Situação atual, Eventos (com Todos e os 7 tipos) e Relatórios", async () => {
    const user = userEvent.setup();
    renderApp("/");
    const nav = await screen.findByRole("navigation", { name: "Principal" });
    expect(within(nav).getByRole("link", { name: "Situação atual" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(nav).getByRole("link", { name: "Relatórios" })).toBeInTheDocument();
    await user.click(within(nav).getByRole("button", { name: /Eventos/ }));
    const links = within(nav)
      .getAllByRole("link")
      .map((l) => l.textContent);
    expect(links).toEqual([
      "Situação atual",
      "Todos os eventos",
      "Ventilador ligado",
      "Ventilador desligado",
      "Temperatura crítica",
      "Falha no sensor",
      "Sensor recuperado",
      "Dispositivo reiniciado",
      "Conexão restabelecida",
      "Relatórios",
    ]);
    await user.click(within(nav).getByRole("link", { name: "Falha no sensor" }));
    expect(
      await screen.findByRole("heading", { name: "Falha no sensor", level: 2 }),
    ).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Falha no sensor" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      within(nav).getByRole("link", { name: "Todos os eventos" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("/relatorios mostra a página de relatórios", async () => {
    renderApp("/relatorios");
    expect(
      await screen.findByRole("heading", { name: "Relatórios", level: 1 }),
    ).toBeInTheDocument();
  });

  it("/login é pública", async () => {
    sessionExpired();
    renderApp("/login");
    expect(await screen.findByRole("heading", { name: "Entrar" })).toBeInTheDocument();
  });

  it("sem sessão, a rota privada vai para o login", async () => {
    sessionExpired();
    renderApp("/");
    expect(await screen.findByRole("heading", { name: "Entrar" })).toBeInTheDocument();
  });

  it("rota desconhecida mostra a página 404", async () => {
    renderApp("/nao-existe");
    expect(
      await screen.findByRole("heading", { name: "Página não encontrada" }),
    ).toBeInTheDocument();
  });

  it("o botão Sair encerra a sessão e vai para o login", async () => {
    const user = userEvent.setup();
    renderApp("/");
    await user.click(await screen.findByRole("button", { name: "Sair" }));
    expect(await screen.findByRole("heading", { name: "Entrar" })).toBeInTheDocument();
  });

  it("o menu tem navegação nomeada e link para pular ao conteúdo", async () => {
    renderApp("/");
    expect(
      await screen.findByRole("navigation", { name: "Principal" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pular para o conteúdo" })).toHaveAttribute(
      "href",
      "#conteudo",
    );
  });
});

describe("ConfigErrorPage", () => {
  it("lista os problemas de configuração", () => {
    render(<ConfigErrorPage issues={["VITE_API_URL: Invalid URL"]} />);
    expect(screen.getByRole("alert")).toHaveTextContent("VITE_API_URL");
  });
});

describe("401 depois do início", () => {
  it("limpa o cache e vai para /login?next=<rota atual>", async () => {
    window.history.pushState({}, "", "/relatorios");
    render(<App />);
    expect(
      await screen.findByRole("heading", { name: "Relatórios", level: 1 }),
    ).toBeInTheDocument();
    await screen.findByText("Resumo de", { exact: false }); // o resumo já chegou

    sessionExpired(); // a sessão vence depois de o painel já estar aberto
    await queryClient.refetchQueries({ queryKey: ["session"] }).catch(() => undefined);

    expect(await screen.findByRole("heading", { name: "Entrar" })).toBeInTheDocument();
    expect(window.location.pathname + window.location.search).toBe(
      "/login?next=%2Frelatorios",
    );
    // A tela de relatórios busca o resumo; sem esperar, a resposta atrasada podia recriar a
    // consulta depois do clear (visto na CI). Esperamos a tela privada sair e conferimos o cache.
    await waitFor(() => expect(queryClient.getQueryCache().getAll()).toHaveLength(0));
  });
});
