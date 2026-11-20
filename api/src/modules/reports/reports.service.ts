import { NotFoundError } from "../../core/errors.js";
import { dayStats } from "../readings/index.js";
import * as repository from "./reports.repository.js";
import type { DailyQuery } from "./reports.schemas.js";

const round2 = (value: number) => Math.round(value * 100) / 100;

export interface DailySummary {
  deviceId: string;
  day: string;
  tempMinC: number;
  tempMaxC: number;
  tempAvgC: number;
  fanOnMinutes: number;
  readingsCount: number;
}

/**
 * Calcula o resumo do dia (America/Sao_Paulo) e grava com upsert. Cada amostra vale
 * 1 minuto, então fan_on_minutes é a contagem de amostras com ventilador ligado.
 * Dia sem leitura: não grava nada e devolve null.
 */
export async function calculateDailySummary({
  deviceId,
  day,
}: DailyQuery): Promise<DailySummary | null> {
  const stats = await dayStats(deviceId, day);
  if (!stats) return null;
  const values = {
    tempMinC: round2(stats.tempMinC),
    tempMaxC: round2(stats.tempMaxC),
    tempAvgC: round2(stats.tempAvgC),
    fanOnMinutes: stats.fanOnMinutes,
    readingsCount: stats.readingsCount,
  };
  await repository.upsert(deviceId, new Date(`${day}T00:00:00Z`), values);
  return { deviceId, day, ...values };
}

/** Consulta do resumo: calcula (idempotente) e responde 404 se o dia não tem leituras. */
export async function dailySummary(query: DailyQuery): Promise<DailySummary> {
  const summary = await calculateDailySummary(query);
  if (!summary) throw new NotFoundError("Sem leituras neste dia");
  return summary;
}
