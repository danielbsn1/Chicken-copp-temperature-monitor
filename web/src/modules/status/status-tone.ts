import type { StatusTone } from "../../shared/ui";
import type { DeviceStatus } from "./status.schemas";

export const ATTENTION_C = 30;
export const CRITICAL_C = 35;
export const OFFLINE_AFTER_MS = 30 * 60_000;

export interface Verdict {
  tone: StatusTone;
  label: string;
}

/** Sem comunicação há mais de 30 min (ou nunca) vale mais que a temperatura; depois, 30 °C e 35 °C. */
export function statusVerdict(status: DeviceStatus, now: number): Verdict {
  const seen = status.lastSeenAt === null ? null : Date.parse(status.lastSeenAt);
  if (seen === null || now - seen > OFFLINE_AFTER_MS || status.reading === null) {
    return { tone: "offline", label: "Sem comunicação" };
  }
  if (status.reading.tempC >= CRITICAL_C) return { tone: "critical", label: "Crítico" };
  if (status.reading.tempC >= ATTENTION_C) return { tone: "attention", label: "Atenção" };
  return { tone: "normal", label: "Normal" };
}
