import { describe, expect, it } from "vitest";
import { relativeRange, saoPauloToUtc } from "./events.period";

describe("relativeRange", () => {
  const now = Date.parse("2026-11-14T12:00:00Z");

  it.each([
    ["6h", "2026-11-14T06:00:00.000Z"],
    ["12h", "2026-11-14T00:00:00.000Z"],
    ["24h", "2026-11-13T12:00:00.000Z"],
    ["7d", "2026-11-07T12:00:00.000Z"],
  ] as const)("%s começa em %s", (period, from) => {
    expect(relativeRange(period, now)).toEqual({ from });
  });

  it("tudo e datas escolhidas não limitam por aqui", () => {
    expect(relativeRange("all", now)).toEqual({});
    expect(relativeRange("custom", now)).toEqual({});
  });
});

describe("saoPauloToUtc", () => {
  it("soma 3 h: a hora de São Paulo vira UTC", () => {
    expect(saoPauloToUtc("2026-11-14T10:00")).toBe("2026-11-14T13:00:00.000Z");
    expect(saoPauloToUtc("2026-11-14T22:30")).toBe("2026-11-15T01:30:00.000Z");
  });

  it("vazio ou inválido vira undefined", () => {
    expect(saoPauloToUtc("")).toBeUndefined();
    expect(saoPauloToUtc("abc")).toBeUndefined();
  });
});
