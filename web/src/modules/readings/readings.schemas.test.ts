import { describe, expect, it } from "vitest";
import { seriesSchema } from "./readings.schemas";

const valid = {
  deviceId: "galinheiro-teste",
  from: "2026-11-14T00:00:00Z",
  to: "2026-11-15T00:00:00Z",
  bucket: "5m",
  points: [{ ts: "2026-11-14T00:00:00Z", minC: 26, avgC: 28, maxC: 31 }],
};

describe("seriesSchema", () => {
  it("aceita a série e a lista vazia de pontos", () => {
    expect(seriesSchema.safeParse(valid).success).toBe(true);
    expect(seriesSchema.safeParse({ ...valid, points: [] }).success).toBe(true);
  });

  it("recusa data fora do formato ISO", () => {
    expect(seriesSchema.safeParse({ ...valid, from: "14/11/2026" }).success).toBe(false);
  });

  it("recusa ponto com temperatura que não é número", () => {
    const points = [{ ts: "2026-11-14T00:00:00Z", minC: "26", avgC: 28, maxC: 31 }];
    expect(seriesSchema.safeParse({ ...valid, points }).success).toBe(false);
  });
});
