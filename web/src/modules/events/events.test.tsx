import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { API, server } from "../../shared/test/server";
import { renderWithProviders } from "../../shared/test/render";
import { EventsList, EventsPage } from "./index";

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

  it("com tipo, busca só aquele tipo e usa o rótulo como título", async () => {
    const calls = serve(2, ["sensor_failure"]);
    renderWithProviders(<EventsList type="sensor_failure" />);
    await screen.findAllByRole("listitem");
    expect(calls.at(-1)?.get("type")).toBe("sensor_failure");
    expect(screen.getByRole("heading", { name: "Falha no sensor" })).toBeInTheDocument();
  });

  it("sem tipo, não envia filtro e o título é Todos os eventos", async () => {
    const calls = serve(2);
    renderWithProviders(<EventsList />);
    await screen.findAllByRole("listitem");
    expect(calls.at(-1)?.has("type")).toBe(false);
    expect(screen.getByRole("heading", { name: "Todos os eventos" })).toBeInTheDocument();
  });
});

describe("filtro por período", () => {
  it("6 h, 12 h, 24 h e 7 dias enviam from; Tudo não envia", async () => {
    const user = userEvent.setup();
    const calls = serve();
    renderWithProviders(<EventsList />);
    await screen.findAllByRole("listitem");
    expect(calls.at(-1)?.has("from")).toBe(false);
    expect(screen.getByRole("button", { name: "Tudo" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    for (const [label, hours] of [
      ["6 h", 6],
      ["12 h", 12],
      ["24 h", 24],
      ["7 dias", 168],
    ] as const) {
      await user.click(screen.getByRole("button", { name: label }));
      await screen.findAllByRole("listitem");
      const params = calls.at(-1)!;
      const hoursBack = (Date.now() - Date.parse(params.get("from")!)) / 3_600_000;
      expect(hoursBack).toBeCloseTo(hours, 1);
      expect(params.has("to")).toBe(false);
      expect(screen.getByRole("button", { name: label })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    }
    await user.click(screen.getByRole("button", { name: "Tudo" }));
    await screen.findAllByRole("listitem");
    expect(calls.at(-1)?.has("from")).toBe(false);
  });

  it("escolher datas mostra De e Até e envia o intervalo em UTC", async () => {
    const user = userEvent.setup();
    const calls = serve();
    renderWithProviders(<EventsList />);
    await screen.findAllByRole("listitem");
    await user.click(screen.getByRole("button", { name: "Escolher datas" }));
    await user.type(screen.getByLabelText("De (data e hora)"), "2026-11-14T10:00");
    await user.type(screen.getByLabelText("Até (data e hora)"), "2026-11-14T12:30");
    await screen.findAllByRole("listitem");
    await vi.waitFor(() => {
      expect(calls.at(-1)?.get("from")).toBe("2026-11-14T13:00:00.000Z");
      expect(calls.at(-1)?.get("to")).toBe("2026-11-14T15:30:00.000Z");
    });
  });

  it("data inicial depois da final mostra aviso e não consulta", async () => {
    const user = userEvent.setup();
    const calls = serve();
    renderWithProviders(<EventsList />);
    await screen.findAllByRole("listitem");
    await user.click(screen.getByRole("button", { name: "Escolher datas" }));
    await user.type(screen.getByLabelText("De (data e hora)"), "2026-11-14T12:00");
    const before = calls.length;
    await user.type(screen.getByLabelText("Até (data e hora)"), "2026-11-14T10:00");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "A data inicial deve ser anterior à final.",
    );
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(
      calls.slice(before).every((c) => c.get("to") !== "2026-11-14T13:00:00.000Z"),
    ).toBe(true);
  });

  it("sem eventos no período mostra o estado vazio do período", async () => {
    const user = userEvent.setup();
    serve(0);
    renderWithProviders(<EventsList />);
    await screen.findByText("Nenhum evento registrado.");
    await user.click(screen.getByRole("button", { name: "24 h" }));
    expect(await screen.findByText("Nenhum evento neste período.")).toBeInTheDocument();
  });
});

describe("EventsPage", () => {
  it("lê o tipo de ?tipo=", async () => {
    const calls = serve();
    renderWithProviders(<EventsPage />, { route: "/eventos?tipo=boot" });
    await screen.findAllByRole("listitem");
    expect(
      screen.getByRole("heading", { name: "Eventos", level: 1 }),
    ).toBeInTheDocument();
    expect(calls.at(-1)?.get("type")).toBe("boot");
  });

  it("tipo desconhecido na URL vira todos", async () => {
    const calls = serve();
    renderWithProviders(<EventsPage />, { route: "/eventos?tipo=xyz" });
    await screen.findAllByRole("listitem");
    expect(calls.at(-1)?.has("type")).toBe(false);
  });
});
