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

describe("saveMany", () => {
  it("repassa as linhas e a transação e devolve quantas foram gravadas", async () => {
    const createMany = vi.fn(async () => 2);
    vi.resetModules();
    vi.doMock("./readings.repository.js", () => ({ createMany }));
    const { saveMany } = await import("./readings.service.js");
    const rows = [{ deviceId: "g", ts: new Date(), tempC: 25, humPct: 50, fanOn: false }];
    const tx = { tx: true };
    expect(await saveMany(rows, tx as never)).toBe(2);
    expect(createMany).toHaveBeenCalledWith(rows, tx);
  });
});
