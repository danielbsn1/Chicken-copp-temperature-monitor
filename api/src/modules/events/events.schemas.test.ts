import { describe, expect, it } from "vitest";
import { listQuery } from "./events.schemas.js";

describe("listQuery", () => {
  it("só exige deviceId e usa limit 50 por padrão", () => {
    expect(listQuery.parse({ deviceId: "g" })).toEqual({ deviceId: "g", limit: 50 });
  });

  it("converte limit, from e to", () => {
    const q = listQuery.parse({
      deviceId: "g",
      from: "2026-11-01T00:00:00Z",
      to: "2026-11-02T00:00:00Z",
      type: "boot",
      limit: "200",
    });
    expect(q.limit).toBe(200);
    expect(q.from).toEqual(new Date("2026-11-01T00:00:00Z"));
    expect(q.type).toBe("boot");
  });

  it.each([
    ["sem deviceId", {}],
    ["limit 0", { deviceId: "g", limit: "0" }],
    ["limit 201", { deviceId: "g", limit: "201" }],
    ["limit não inteiro", { deviceId: "g", limit: "1.5" }],
    ["limit texto", { deviceId: "g", limit: "muitos" }],
    ["type desconhecido", { deviceId: "g", type: "explodiu" }],
    ["from sem fuso", { deviceId: "g", from: "2026-11-01T00:00:00" }],
    [
      "from depois de to",
      { deviceId: "g", from: "2026-11-02T00:00:00Z", to: "2026-11-01T00:00:00Z" },
    ],
  ])("rejeita %s", (_nome, query) => {
    expect(listQuery.safeParse(query).success).toBe(false);
  });
});
