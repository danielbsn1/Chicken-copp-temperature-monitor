import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse, type JsonBodyType } from "msw";
import { describe, expect, it } from "vitest";
import { API, server } from "../../shared/test/server";
import { renderWithProviders } from "../../shared/test/render";
import { StatusCard } from "./index";

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

function respond(body: JsonBodyType, status = 200) {
  server.use(http.get(`${API}/status`, () => HttpResponse.json(body, { status })));
}

const reading = (tempC: number, fanOn = false) => ({
  ts: minutesAgo(2),
  tempC,
  humPct: 62,
  fanOn,
});

describe("StatusCard", () => {
  it("mostra carregando e depois temperatura, umidade, ventilador, comunicação e firmware", async () => {
    renderWithProviders(<StatusCard />);
    expect(screen.getByRole("status")).toHaveTextContent("Carregando");
    expect(await screen.findByText("27,4 °C")).toBeInTheDocument();
    expect(screen.getByText("62 %")).toBeInTheDocument();
    expect(screen.getByText("Desligado")).toBeInTheDocument();
    expect(screen.getByText("2.0.1")).toBeInTheDocument();
    expect(screen.getByText("Normal")).toBeInTheDocument();
    expect(screen.getByText("Última comunicação")).toBeInTheDocument();
  });

  it("mostra o ventilador ligado e o selo Crítico a partir de 35 °C", async () => {
    respond({
      reading: reading(35.2, true),
      fanOn: true,
      lastSeenAt: minutesAgo(2),
      fwVersion: "2.0.1",
    });
    renderWithProviders(<StatusCard />);
    expect(await screen.findByText("Crítico")).toBeInTheDocument();
    expect(screen.getByText("Ligado")).toBeInTheDocument();
  });

  it("mostra Atenção a partir de 30 °C", async () => {
    respond({
      reading: reading(30),
      fanOn: false,
      lastSeenAt: minutesAgo(2),
      fwVersion: null,
    });
    renderWithProviders(<StatusCard />);
    expect(await screen.findByText("Atenção")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument(); // firmware desconhecido
  });

  it("mostra Sem comunicação quando a última comunicação passa de 30 min", async () => {
    respond({
      reading: reading(27),
      fanOn: false,
      lastSeenAt: minutesAgo(45),
      fwVersion: "2.0.1",
    });
    renderWithProviders(<StatusCard />);
    expect(await screen.findByText("Sem comunicação")).toBeInTheDocument();
  });

  it("dispositivo que nunca enviou dados: sem comunicação e valores vazios", async () => {
    respond({ reading: null, fanOn: null, lastSeenAt: null, fwVersion: null });
    renderWithProviders(<StatusCard />);
    expect(await screen.findByText("Sem comunicação")).toBeInTheDocument();
    expect(screen.getByText("Nunca")).toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(4);
  });

  it("erro mostra a mensagem e 'Tentar de novo' busca de novo", async () => {
    const user = userEvent.setup();
    respond({ error: { code: "INTERNAL_ERROR", message: "x" } }, 500);
    renderWithProviders(<StatusCard />);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Não foi possível carregar o status.");

    server.resetHandlers();
    await user.click(within(alert).getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByText("27,4 °C")).toBeInTheDocument();
  });

  it("atualiza a cada 60 s", async () => {
    const { client } = renderWithProviders(<StatusCard />);
    await screen.findByText("27,4 °C");
    const observer = client
      .getQueryCache()
      .find({ queryKey: ["status", "galinheiro-teste"], exact: false })?.observers[0];
    expect(observer?.options.refetchInterval).toBe(60_000);
  });
});
