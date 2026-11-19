import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { describe, expect, it } from "vitest";
import { API, server } from "../shared/test/server";
import { ConfigErrorPage } from "./pages/ConfigErrorPage";
import { createQueryClient } from "./query-client";
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
  it("/ mostra o painel com status, gráfico e eventos", async () => {
    renderApp("/");
    expect(
      await screen.findByRole("heading", { name: "Painel", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(
      "Os dados chegam em lotes de 15 min.",
    );
    expect(screen.getByRole("heading", { name: "Situação atual" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Temperatura" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Eventos" })).toBeInTheDocument();
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
