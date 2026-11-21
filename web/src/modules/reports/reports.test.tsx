import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { yesterdayInSaoPaulo } from "../../shared/format/date";
import { API, server } from "../../shared/test/server";
import { renderWithProviders } from "../../shared/test/render";
import { ReportsPage } from "./index";

/** Responde o resumo e guarda o `day` de cada pedido. */
function serve(status = 200) {
  const days: (string | null)[] = [];
  server.use(
    http.get(`${API}/reports/daily`, ({ request }) => {
      const params = new URL(request.url).searchParams;
      days.push(params.get("day"));
      if (status === 404) {
        return HttpResponse.json(
          { error: { code: "NOT_FOUND", message: "Sem resumo para este dia" } },
          { status: 404 },
        );
      }
      if (status === 500) {
        return HttpResponse.json(
          { error: { code: "INTERNAL_ERROR", message: "x" } },
          { status: 500 },
        );
      }
      return HttpResponse.json({
        deviceId: params.get("deviceId"),
        day: params.get("day"),
        tempMinC: 22.1,
        tempMaxC: 33.9,
        tempAvgC: 27.5,
        fanOnMinutes: 90,
        readingsCount: 1380,
      });
    }),
  );
  return days;
}

describe("ReportsPage", () => {
  afterEach(() => vi.useRealTimers());

  it("o seletor de dia começa em ontem, no fuso de São Paulo", async () => {
    const days = serve();
    renderWithProviders(<ReportsPage />);
    const input = screen.getByLabelText("Dia");
    expect(input).toHaveValue(yesterdayInSaoPaulo());
    expect(input).toHaveAttribute("max", yesterdayInSaoPaulo());
    await screen.findByText("Resumo de", { exact: false });
    expect(days[0]).toBe(yesterdayInSaoPaulo());
  });

  it("mostra carregando e depois mínima, máxima, média, minutos de ventilador e leituras", async () => {
    serve();
    renderWithProviders(<ReportsPage />);
    expect(screen.getByRole("status")).toHaveTextContent("Carregando");
    const item = (name: string) => screen.getByText(name).nextElementSibling;
    expect(await screen.findByText("22,1 °C")).toBeInTheDocument();
    expect(item("Temperatura mínima")).toHaveTextContent("22,1 °C");
    expect(item("Temperatura máxima")).toHaveTextContent("33,9 °C");
    expect(item("Temperatura média")).toHaveTextContent("27,5 °C");
    expect(item("Ventilador ligado")).toHaveTextContent("90 min");
    expect(item("Leituras")).toHaveTextContent("1380");
  });

  it("trocar o dia busca o resumo daquele dia e mostra a data em pt-BR", async () => {
    const user = userEvent.setup();
    const days = serve();
    renderWithProviders(<ReportsPage />);
    await screen.findByText("22,1 °C");
    const input = screen.getByLabelText("Dia");
    await user.clear(input);
    await user.type(input, "2026-11-10");
    expect(await screen.findByText("Resumo de 10/11/2026")).toBeInTheDocument();
    expect(days.at(-1)).toBe("2026-11-10");
  });

  it("Baixar CSV é um link para /reports/daily com format=csv", async () => {
    serve();
    renderWithProviders(<ReportsPage />);
    const link = await screen.findByRole("link", { name: "Baixar CSV" });
    const url = new URL(link.getAttribute("href")!);
    expect(url.origin + url.pathname).toBe(`${API}/reports/daily`);
    expect(url.searchParams.get("format")).toBe("csv");
    expect(url.searchParams.get("day")).toBe(yesterdayInSaoPaulo());
    expect(url.searchParams.get("deviceId")).toBe("galinheiro-teste");
    expect(link).toHaveAttribute("download");
  });

  it("404 mostra 'Sem resumo para este dia' e esconde o CSV", async () => {
    serve(404);
    renderWithProviders(<ReportsPage />);
    expect(await screen.findByText("Sem resumo para este dia.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Baixar CSV" })).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("erro do servidor mostra a mensagem e 'Tentar de novo' busca de novo", async () => {
    const user = userEvent.setup();
    serve(500);
    renderWithProviders(<ReportsPage />);
    const alert = await screen.findByRole("alert", undefined, { timeout: 8000 });
    expect(alert).toHaveTextContent("Não foi possível carregar o resumo.");
    serve();
    await user.click(within(alert).getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByText("22,1 °C")).toBeInTheDocument();
  });

  it("sem dia escolhido pede para escolher um", async () => {
    const user = userEvent.setup();
    serve();
    renderWithProviders(<ReportsPage />);
    await screen.findByText("22,1 °C");
    await user.clear(screen.getByLabelText("Dia"));
    expect(await screen.findByText("Escolha um dia.")).toBeInTheDocument();
  });
});
