export type PeriodId = "6h" | "24h" | "7d" | "30d";
export type Bucket = "1m" | "5m" | "15m" | "1h";

export interface Period {
  id: PeriodId;
  label: string;
  durationMs: number;
  bucket: Bucket;
}

const HOUR = 3_600_000;

/** Cada período usa um bucket que mantém a série abaixo de 1.000 pontos (360, 288, 672 e 720). */
export const PERIODS: readonly Period[] = [
  { id: "6h", label: "6 h", durationMs: 6 * HOUR, bucket: "1m" },
  { id: "24h", label: "24 h", durationMs: 24 * HOUR, bucket: "5m" },
  { id: "7d", label: "7 dias", durationMs: 7 * 24 * HOUR, bucket: "15m" },
  { id: "30d", label: "30 dias", durationMs: 30 * 24 * HOUR, bucket: "1h" },
];

export const DEFAULT_PERIOD: PeriodId = "24h";

export function periodById(id: PeriodId): Period {
  return PERIODS.find((p) => p.id === id) ?? PERIODS[1]!;
}
