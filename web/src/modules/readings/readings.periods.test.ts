import { describe, expect, it } from "vitest";
import { DEFAULT_PERIOD, PERIODS, periodById } from "./readings.periods";

const BUCKET_MS = { "1m": 60_000, "5m": 300_000, "15m": 900_000, "1h": 3_600_000 };

describe("mapa de período para agregação", () => {
  it.each([
    ["6h", "1m", 360],
    ["24h", "5m", 288],
    ["7d", "15m", 672],
    ["30d", "1h", 720],
  ] as const)("%s usa o bucket %s (%i pontos)", (id, bucket, points) => {
    const period = periodById(id);
    expect(period.bucket).toBe(bucket);
    expect(period.durationMs / BUCKET_MS[bucket]).toBe(points);
  });

  it("nenhum período passa do limite de 1.000 pontos da API", () => {
    for (const p of PERIODS) {
      expect(p.durationMs / BUCKET_MS[p.bucket]).toBeLessThan(1000);
    }
  });

  it("o padrão é 24 h e um id desconhecido cai nele", () => {
    expect(DEFAULT_PERIOD).toBe("24h");
    expect(periodById("x" as never).id).toBe("24h");
  });
});
