import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { API, server } from "../../shared/test/server";
import { renderWithProviders } from "../../shared/test/render";
import { EventsList } from "./index";

/** Responde com `count` eventos (do mais novo para o mais antigo) e guarda os parâmetros. */
function serve(count = 2, types: string[] = ["fan_on"]) {
  const calls: URLSearchParams[] = [];
  server.use(
    http.get(`${API}/events`, ({ request }) => {
      const params = new URL(request.url).searchParams;
      calls.push(params);
      const limit = Number(params.get("limit"));
      const total = Math.min(count, limit);
      const base = Date.parse("2026-11-14T13:00:00Z");
      return HttpResponse.json({
        deviceId: params.get("deviceId"),
        events: Array.from({ length: total }, (_, i) => ({
          ts: new Date(base - i * 60_000).toISOString(),
          type: types[i % types.length]!,
          detail: null,
        })),
      });
    }),
  );
  return calls;
}

describe("EventsList", () => {
  it("lista do mais novo para o mais antigo, com rótulo em português e hora de São Paulo", async () => {
    renderWithProviders(<EventsList />);
    expect(screen.getByRole("status")).toHaveTextContent("Carregando");
    const items = await screen.findAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("14/11/2026, 10:05");
    expect(items[0]).toHaveTextContent("Ventilador desligado");
    expect(items[1]).toHaveTextContent("14/11/2026, 10:00");
    expect(items[1]).toHaveTextContent("Ventilador ligado");
  });

  it("tipo sem rótulo aparece com o próprio código", async () => {
    server.use(
      http.get(`${API}/events`, () =>
        HttpResponse.json({
          deviceId: "galinheiro-teste",
          events: [{ ts: "2026-11-14T13:00:00.000Z", type: "tipo_novo", detail: null }],
        }),
      ),
    );
    renderWithProviders(<EventsList />);
    expect(await screen.findByText("tipo_novo")).toBeInTheDocument();
  });

  it("sem eventos mostra o estado vazio", async () => {
    serve(0);
    renderWithProviders(<EventsList />);
    expect(await screen.findByText("Nenhum evento registrado.")).toBeInTheDocument();
  });

  it("erro mostra a mensagem e 'Tentar de novo' busca de novo", async () => {
    const user = userEvent.setup();
    server.use(
      http.get(`${API}/events`, () =>
        HttpResponse.json(
          { error: { code: "INTERNAL_ERROR", message: "x" } },
          { status: 500 },
        ),
      ),
    );
    renderWithProviders(<EventsList />);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Não foi possível carregar os eventos.");
    server.resetHandlers();
    await user.click(within(alert).getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findAllByRole("listitem")).toHaveLength(2);
  });

  it("começa com limite 50 e Ver mais sobe de 50 em 50 até 200", async () => {
    const user = userEvent.setup();
    const calls = serve(500);
    renderWithProviders(<EventsList />);
    expect(await screen.findAllByRole("listitem")).toHaveLength(50);
    expect(calls.at(-1)?.get("limit")).toBe("50");

    for (const [limit, shown] of [
      ["100", 100],
      ["150", 150],
      ["200", 200],
    ] as const) {
      await user.click(screen.getByRole("button", { name: "Ver mais" }));
      await screen.findByText(
        (_, el) => el?.tagName === "UL" && el.children.length === shown,
      );
      expect(calls.at(-1)?.get("limit")).toBe(limit);
    }
    expect(screen.queryByRole("button", { name: "Ver mais" })).not.toBeInTheDocument();
    expect(
      screen.getByText("Mostrando os 200 eventos mais recentes."),
    ).toBeInTheDocument();
  });

  it("sem mais eventos que o limite, não mostra Ver mais", async () => {
    serve(10);
    renderWithProviders(<EventsList />);
    await screen.findAllByRole("listitem");
    expect(screen.queryByRole("button", { name: "Ver mais" })).not.toBeInTheDocument();
  });

  it("o filtro por tipo atualiza a lista e volta o limite para 50", async () => {
    const user = userEvent.setup();
    const calls = serve(500);
    renderWithProviders(<EventsList />);
    await screen.findAllByRole("listitem");
    await user.click(screen.getByRole("button", { name: "Ver mais" }));
    await screen.findByText(
      (_, el) => el?.tagName === "UL" && el.children.length === 100,
    );

    await user.selectOptions(screen.getByLabelText("Tipo de evento"), "Falha no sensor");
    await screen.findAllByRole("listitem");
    expect(calls.at(-1)?.get("type")).toBe("sensor_failure");
    expect(calls.at(-1)?.get("limit")).toBe("50");

    await user.selectOptions(screen.getByLabelText("Tipo de evento"), "Todos");
    await screen.findAllByRole("listitem");
    expect(calls.at(-1)?.has("type")).toBe(false);
  });

  it("o filtro oferece Todos e os 7 tipos com rótulo em português", () => {
    renderWithProviders(<EventsList />);
    const options = within(screen.getByLabelText("Tipo de evento")).getAllByRole(
      "option",
    );
    expect(options.map((o) => o.textContent)).toEqual([
      "Todos",
      "Ventilador ligado",
      "Ventilador desligado",
      "Temperatura crítica",
      "Falha no sensor",
      "Sensor recuperado",
      "Dispositivo reiniciado",
      "Conexão restabelecida",
    ]);
  });
});
