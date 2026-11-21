import { afterEach, describe, expect, it, vi } from "vitest";
import { notificationsRouter } from "./index.js";
import {
  formatDailySummary,
  sendTelegram,
  TelegramError,
} from "./notifications.service.js";

describe("módulo notifications", () => {
  it("expõe o router pela interface pública", () => {
    expect(typeof notificationsRouter).toBe("function");
  });
});

describe("formatDailySummary", () => {
  it("monta o texto em português com data, temperaturas, ventilador e leituras", () => {
    expect(
      formatDailySummary({
        deviceName: "Galinheiro",
        day: "2026-11-14",
        tempMinC: 22.1,
        tempMaxC: 33.99,
        tempAvgC: 27.46,
        fanOnMinutes: 90,
        readingsCount: 1380,
      }),
    ).toBe(
      [
        "Resumo de 14/11/2026 — Galinheiro",
        "Temperatura: mínima 22,1 °C, média 27,5 °C, máxima 34,0 °C",
        "Ventilador: 90 min ligado",
        "Leituras: 1380",
      ].join("\n"),
    );
  });
});

describe("sendTelegram", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("envia o texto à conversa configurada", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await sendTelegram("olá");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.telegram.org/bot123456:token-de-teste/sendMessage");
    expect(JSON.parse(init.body as string)).toEqual({
      chat_id: "-1000000000000",
      text: "olá",
    });
  });

  it("resposta de erro vira TelegramError sem o token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 502 })),
    );
    const error = await sendTelegram("x").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(TelegramError);
    expect((error as Error).message).toContain("502");
    expect((error as Error).message).not.toContain("token-de-teste");
  });

  it("falha de rede vira TelegramError sem expor a URL com o token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error(
          "fetch failed https://api.telegram.org/bot123456:token-de-teste/sendMessage",
        );
      }),
    );
    const error = await sendTelegram("x").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(TelegramError);
    expect((error as Error).message).not.toContain("token-de-teste");
  });
});
