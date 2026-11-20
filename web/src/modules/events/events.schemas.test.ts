import { describe, expect, it } from "vitest";
import { eventsSchema } from "./events.schemas";

describe("eventsSchema", () => {
  it("aceita eventos com detalhe nulo ou qualquer JSON", () => {
    const body = {
      deviceId: "galinheiro-teste",
      events: [
        { ts: "2026-11-14T13:00:00Z", type: "fan_on", detail: null },
        { ts: "2026-11-14T13:05:00Z", type: "boot", detail: { fw: "1.0.0" } },
      ],
    };
    expect(eventsSchema.safeParse(body).success).toBe(true);
  });

  it("aceita lista vazia", () => {
    expect(eventsSchema.safeParse({ deviceId: "a", events: [] }).success).toBe(true);
  });

  it("recusa evento sem tipo ou com data inválida", () => {
    const ev = (e: object) => ({ deviceId: "a", events: [e] });
    expect(
      eventsSchema.safeParse(ev({ ts: "2026-11-14T13:00:00Z", detail: null })).success,
    ).toBe(false);
    expect(
      eventsSchema.safeParse(ev({ ts: "ontem", type: "boot", detail: null })).success,
    ).toBe(false);
  });
});
