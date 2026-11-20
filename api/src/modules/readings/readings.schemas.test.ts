import { describe, expect, it } from "vitest";
import { seriesQuery } from "./readings.schemas.js";

const base = {
  deviceId: "g",
  from: "2026-11-01T00:00:00Z",
  to: "2026-11-01T06:00:00Z",
  bucket: "5m",
};

describe("seriesQuery", () => {
  it("converte from e to em Date", () => {
    const q = seriesQuery.parse(base);
    expect(q.from).toEqual(new Date("2026-11-01T00:00:00Z"));
    expect(q.to).toEqual(new Date("2026-11-01T06:00:00Z"));
  });

  it.each(["1m", "5m", "15m", "1h"])("aceita o bucket %s", (bucket) => {
    expect(
      seriesQuery.safeParse({ ...base, bucket, to: "2026-11-01T01:00:00Z" }).success,
    ).toBe(true);
  });

  it.each([
    ["sem deviceId", { deviceId: undefined }],
    ["deviceId inválido", { deviceId: "Galpão 1" }],
    ["sem from", { from: undefined }],
    ["sem to", { to: undefined }],
    ["from sem fuso", { from: "2026-11-01T00:00:00" }],
    ["from com fuso diferente de UTC", { from: "2026-11-01T00:00:00-03:00" }],
    ["from igual a to", { to: "2026-11-01T00:00:00Z" }],
    ["from depois de to", { from: "2026-11-02T00:00:00Z" }],
    ["sem bucket", { bucket: undefined }],
    ["bucket desconhecido", { bucket: "30m" }],
  ])("rejeita %s", (_nome, over) => {
    expect(seriesQuery.safeParse({ ...base, ...over }).success).toBe(false);
  });

  it("aceita exatamente 1.000 pontos e rejeita 1.001", () => {
    const from = "2026-11-01T00:00:00Z";
    const at = (minutes: number) =>
      new Date(Date.parse(from) + minutes * 60_000).toISOString();
    expect(
      seriesQuery.safeParse({ ...base, from, to: at(1000), bucket: "1m" }).success,
    ).toBe(true);
    expect(
      seriesQuery.safeParse({ ...base, from, to: at(1001), bucket: "1m" }).success,
    ).toBe(false);
  });
});
