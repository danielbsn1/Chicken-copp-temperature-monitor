export type PeriodId = "all" | "6h" | "12h" | "24h" | "7d" | "custom";

const HOUR = 3_600_000;

export const EVENT_PERIODS: { id: PeriodId; label: string; durationMs?: number }[] = [
  { id: "all", label: "Tudo" },
  { id: "6h", label: "6 h", durationMs: 6 * HOUR },
  { id: "12h", label: "12 h", durationMs: 12 * HOUR },
  { id: "24h", label: "24 h", durationMs: 24 * HOUR },
  { id: "7d", label: "7 dias", durationMs: 7 * 24 * HOUR },
  { id: "custom", label: "Escolher datas" },
];

/** Os últimos N ms até `now`, em UTC. "Tudo" não limita. */
export function relativeRange(period: PeriodId, now: number) {
  const ms = EVENT_PERIODS.find((p) => p.id === period)?.durationMs;
  return ms ? { from: new Date(now - ms).toISOString() } : {};
}

/**
 * Converte o valor de um `datetime-local` ("2026-11-14T10:00"), que é a hora de
 * São Paulo (UTC−3, sem horário de verão), em ISO 8601 UTC. Vazio ou inválido: undefined.
 */
export function saoPauloToUtc(value: string): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}:00-03:00`);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}
