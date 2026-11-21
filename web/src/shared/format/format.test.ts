import { describe, expect, it } from "vitest";
import {
  formatDateTime,
  formatDay,
  formatDayMonth,
  formatTime,
  toSaoPauloDay,
  yesterdayInSaoPaulo,
} from "./date";
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

describe("formatDayMonth", () => {
  it("mostra dia/mês de São Paulo", () => {
    expect(formatDayMonth("2026-11-14T01:30:00Z")).toBe("13/11");
  });
});

describe("dia civil de São Paulo", () => {
  it("yesterdayInSaoPaulo usa o dia de São Paulo, não o de UTC", () => {
    // 01:30 UTC do dia 15 ainda é 22:30 do dia 14 em São Paulo; ontem é o dia 13
    expect(yesterdayInSaoPaulo("2026-11-15T01:30:00Z")).toBe("2026-11-13");
    expect(yesterdayInSaoPaulo("2026-11-15T10:00:00Z")).toBe("2026-11-14");
    expect(yesterdayInSaoPaulo("2026-03-01T12:00:00Z")).toBe("2026-02-28");
  });

  it("formatDay mostra dia/mês/ano sem mudar de dia", () => {
    expect(formatDay("2026-11-14")).toBe("14/11/2026");
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

  it("formatTemp e formatPct tratam zero e negativos", () => {
    expect(formatTemp(0)).toBe("0,0 °C");
    expect(formatTemp(-1.25)).toBe("-1,3 °C");
    expect(formatPct(0)).toBe("0 %");
  });
});
