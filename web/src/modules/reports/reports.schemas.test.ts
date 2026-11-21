import { describe, expect, it } from "vitest";
import { dailySchema } from "./reports.schemas";

const valid = {
  deviceId: "galinheiro-teste",
  day: "2026-11-14",
  tempMinC: 22.1,
  tempMaxC: 33.9,
  tempAvgC: 27.5,
  fanOnMinutes: 90,
  readingsCount: 1380,
};

describe("dailySchema", () => {
  it("aceita o resumo do dia", () => {
    expect(dailySchema.safeParse(valid).success).toBe(true);
  });

  it.each([
    ["dia fora do formato", { day: "14/11/2026" }],
    ["minutos de ventilador fracionados", { fanOnMinutes: 1.5 }],
    ["temperatura em texto", { tempAvgC: "27,5" }],
    ["sem leituras", { readingsCount: undefined }],
  ])("recusa %s", (_nome, over) => {
    expect(dailySchema.safeParse({ ...valid, ...over }).success).toBe(false);
  });
});
