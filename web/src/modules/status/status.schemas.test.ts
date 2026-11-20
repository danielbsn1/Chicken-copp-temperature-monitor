import { describe, expect, it } from "vitest";
import { statusSchema } from "./status.schemas";

describe("statusSchema", () => {
  it("aceita o status completo", () => {
    const body = {
      reading: { ts: "2026-11-14T13:00:00Z", tempC: 27.4, humPct: 62, fanOn: false },
      fanOn: false,
      lastSeenAt: "2026-11-14T13:00:00Z",
      fwVersion: "1.2.0",
    };
    expect(statusSchema.safeParse(body).success).toBe(true);
  });

  it("aceita dispositivo que nunca enviou dados (tudo nulo)", () => {
    const body = { reading: null, fanOn: null, lastSeenAt: null, fwVersion: null };
    expect(statusSchema.safeParse(body).success).toBe(true);
  });

  it("recusa leitura com umidade em texto e data inválida", () => {
    const reading = { ts: "2026-11-14T13:00:00Z", tempC: 27, humPct: "62", fanOn: false };
    expect(
      statusSchema.safeParse({ reading, fanOn: false, lastSeenAt: null, fwVersion: null })
        .success,
    ).toBe(false);
    expect(
      statusSchema.safeParse({
        reading: null,
        fanOn: null,
        lastSeenAt: "ontem",
        fwVersion: null,
      }).success,
    ).toBe(false);
  });
});
