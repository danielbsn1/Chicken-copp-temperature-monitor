import { http, HttpResponse } from "msw";
import { screen } from "@testing-library/react";
import { Route, Routes, useLocation } from "react-router";
import { describe, expect, it } from "vitest";
import { API, server } from "../../shared/test/server";
import { renderWithProviders } from "../../shared/test/render";
import { RequireAuth } from "./index";

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
