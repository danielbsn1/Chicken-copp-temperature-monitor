import { describe, expect, it, vi } from "vitest";
import { eventsRouter } from "./index.js";

describe("módulo events", () => {
  it("expõe o router pela interface pública", () => {
    expect(typeof eventsRouter).toBe("function");
  });
});

describe("saveMany", () => {
  it("repassa as linhas e a transação e devolve quantas foram gravadas", async () => {
    const createMany = vi.fn(async () => 1);
    vi.resetModules();
    vi.doMock("./events.repository.js", () => ({ createMany }));
    const { saveMany } = await import("./events.service.js");
    const rows = [
      { deviceId: "g", ts: new Date(), type: "boot", detail: { reason: "power_on" } },
    ];
    const tx = { tx: true };
    expect(await saveMany(rows, tx as never)).toBe(1);
    expect(createMany).toHaveBeenCalledWith(rows, tx);
  });
});
