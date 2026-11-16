import { describe, expect, it } from "vitest";
import { formatDateTime, formatTime, toSaoPauloDay } from "./date";
import { formatPct, formatTemp } from "./number";

describe("date", () => {
  it("formatDateTime converte UTC para America/Sao_Paulo em pt-BR", () => {
    expect(formatDateTime("2026-11-14T13:05:00Z")).toBe("14/11/2026, 10:05");
  });

  it("formatTime mostra só a hora de São Paulo", () => {
    expect(formatTime("2026-11-14T13:05:00Z")).toBe("10:05");
  });

  it("toSaoPauloDay usa o dia de São Paulo, não o de UTC", () => {
    expect(toSaoPauloDay("2026-11-14T01:30:00Z")).toBe("2026-11-13");
    expect(toSaoPauloDay(new Date("2026-11-14T12:00:00Z"))).toBe("2026-11-14");
  });
});

describe("number", () => {
  it("formatTemp usa vírgula, uma casa decimal e °C", () => {
    expect(formatTemp(27.4)).toBe("27,4 °C");
    expect(formatTemp(30)).toBe("30,0 °C");
  });

  it("formatPct não tem casas decimais e mostra %", () => {
    expect(formatPct(62)).toBe("62 %");
    expect(formatPct(61.6)).toBe("62 %");
  });
});
