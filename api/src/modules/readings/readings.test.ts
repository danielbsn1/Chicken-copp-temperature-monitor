import { describe, expect, it, vi } from "vitest";
import { readingsRouter } from "./index.js";

describe("módulo readings", () => {
  it("expõe o router pela interface pública", () => {
    expect(typeof readingsRouter).toBe("function");
  });
});

describe("latestReading", () => {
  it("devolve a última leitura do repositório", async () => {
    const reading = { ts: new Date(), tempC: 25, humPct: 50, fanOn: false };
    vi.resetModules();
    vi.doMock("./readings.repository.js", () => ({ findLatest: async () => reading }));
    const { latestReading } = await import("./readings.service.js");
    expect(await latestReading("g")).toBe(reading);
  });
});
