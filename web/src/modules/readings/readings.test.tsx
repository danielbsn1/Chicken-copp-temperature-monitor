import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { API, server } from "../../shared/test/server";
import { renderWithProviders } from "../../shared/test/render";
import { ReadingsChart } from "./index";

const BUCKET_MS = { "1m": 60_000, "5m": 300_000, "15m": 900_000, "1h": 3_600_000 };

/** Guarda os parâmetros de cada chamada ao /readings. */
function recordRequests() {
  const calls: URLSearchParams[] = [];
  server.use(
    http.get(`${API}/readings`, ({ request }) => {
      const params = new URL(request.url).searchParams;
      calls.push(params);
      return HttpResponse.json({
        deviceId: params.get("deviceId"),
        from: params.get("from"),
        to: params.get("to"),
        bucket: params.get("bucket"),
        points: [
          { ts: "2026-11-14T13:00:00.000Z", minC: 26, avgC: 27, maxC: 28.5 },
          { ts: "2026-11-14T13:05:00.000Z", minC: 27, avgC: 29, maxC: 31 },
        ],
      });
    }),
  );
  return calls;
}

describe("ReadingsChart", () => {
  it("usa 24 h com bucket 5m por padrão e descreve a série no aria-label", async () => {
    const calls = recordRequests();
    renderWithProviders(<ReadingsChart />);
    expect(screen.getByRole("status")).toHaveTextContent("Carregando");
    expect(await screen.findByRole("img")).toHaveAccessibleName(
      "Temperatura no período: mínima 26,0 °C, média 28,0 °C, máxima 31,0 °C",
    );
    expect(screen.getByRole("button", { name: "24 h" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]?.get("bucket")).toBe("5m");
    expect(calls[0]?.get("deviceId")).toBe("galinheiro-teste");
  });

  it.each([
    ["6 h", "1m", 6 * 3_600_000, 360],
    ["24 h", "5m", 24 * 3_600_000, 288],
    ["7 dias", "15m", 7 * 24 * 3_600_000, 672],
    ["30 dias", "1h", 30 * 24 * 3_600_000, 720],
  ])(
    "%s usa o bucket %s e fica abaixo de 1.000 pontos",
    async (label, bucket, ms, points) => {
      const user = userEvent.setup();
      const calls = recordRequests();
      renderWithProviders(<ReadingsChart />);
      await screen.findByRole("img");
      if (label !== "24 h") await user.click(screen.getByRole("button", { name: label }));
      await screen.findByRole("img");
      const call = calls.at(-1)!;
      expect(call.get("bucket")).toBe(bucket);
      const span = Date.parse(call.get("to")!) - Date.parse(call.get("from")!);
      expect(span).toBe(ms);
      expect(points).toBeLessThan(1000);
      expect(span / BUCKET_MS[bucket as keyof typeof BUCKET_MS]).toBe(points);
    },
  );

  it("mostra mínima, média e máxima do período em cartões", async () => {
    renderWithProviders(<ReadingsChart />);
    await screen.findByRole("img");
    expect(screen.getByText("Mínima no período").nextSibling).toHaveTextContent(
      "26,0 °C",
    );
    expect(screen.getByText("Média no período").nextSibling).toHaveTextContent("28,0 °C");
    expect(screen.getByText("Máxima no período").nextSibling).toHaveTextContent(
      "31,0 °C",
    );
  });

  it("sem leituras mostra o estado vazio", async () => {
    server.use(
      http.get(`${API}/readings`, () =>
        HttpResponse.json({
          deviceId: "galinheiro-1",
          from: "2026-11-14T00:00:00.000Z",
          to: "2026-11-15T00:00:00.000Z",
          bucket: "5m",
          points: [],
        }),
      ),
    );
    renderWithProviders(<ReadingsChart />);
    expect(await screen.findByText("Sem leituras no período.")).toBeInTheDocument();
  });

  it("erro mostra a mensagem e 'Tentar de novo' busca de novo", async () => {
    const user = userEvent.setup();
    server.use(
      http.get(`${API}/readings`, () =>
        HttpResponse.json(
          { error: { code: "INTERNAL_ERROR", message: "x" } },
          { status: 500 },
        ),
      ),
    );
    renderWithProviders(<ReadingsChart />);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Não foi possível carregar as leituras.");
    server.resetHandlers();
    await user.click(within(alert).getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByRole("img")).toBeInTheDocument();
  });

  it("atualiza a cada 60 s", async () => {
    const { client } = renderWithProviders(<ReadingsChart />);
    await screen.findByRole("img");
    const observer = client.getQueryCache().find({ queryKey: ["readings", "24h"] })
      ?.observers[0];
    expect(observer?.options.refetchInterval).toBe(60_000);
  });
});
