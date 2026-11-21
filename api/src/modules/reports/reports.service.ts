import { NotFoundError } from "../../core/errors.js";
import { logger } from "../../core/logger.js";
import { purgeLoginAttempts } from "../auth/index.js";
import { purgeAnnouncements } from "../pairing/index.js";
import { listDevices } from "../devices/index.js";
import { formatDailySummary, sendTelegram } from "../notifications/index.js";
import { dayStats, purgeBefore } from "../readings/index.js";
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
}: Pick<DailyQuery, "deviceId" | "day">): Promise<DailySummary | null> {
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

/** Consulta do resumo já gravado (o job diário é quem calcula); 404 se o dia não tem resumo. */
export async function dailySummary({
  deviceId,
  day,
}: Pick<DailyQuery, "deviceId" | "day">): Promise<DailySummary> {
  const row = await repository.find(deviceId, new Date(`${day}T00:00:00Z`));
  if (!row) throw new NotFoundError("Sem resumo para este dia");
  return {
    deviceId,
    day,
    // Os valores ficam em float4 no banco; arredonda de novo para não vazar ruído de ponto flutuante.
    tempMinC: round2(row.tempMinC),
    tempMaxC: round2(row.tempMaxC),
    tempAvgC: round2(row.tempAvgC),
    fanOnMinutes: row.fanOnMinutes,
    readingsCount: row.readingsCount,
  };
}

/** CSV (RFC 4180, UTF-8 com BOM para o Excel) com cabeçalho e unidades; ponto decimal. */
export function summaryToCsv(summary: DailySummary): string {
  const header = [
    "Dia",
    "Temperatura mínima (°C)",
    "Temperatura máxima (°C)",
    "Temperatura média (°C)",
    "Ventilador ligado (min)",
    "Leituras",
  ];
  const row = [
    summary.day,
    summary.tempMinC,
    summary.tempMaxC,
    summary.tempAvgC,
    summary.fanOnMinutes,
    summary.readingsCount,
  ];
  return `\uFEFF${header.join(",")}\r\n${row.join(",")}\r\n`;
}

const DAY_MS = 86_400_000;
/** Quantos dias para trás o job ainda tenta reenviar um resumo que falhou. */
export const RETRY_DAYS = 2;
const LOGIN_ATTEMPTS_DAYS = 7;
const READINGS_MONTHS = 12;

const saoPauloDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Dia civil (AAAA-MM-DD) em America/Sao_Paulo, `daysBack` dias antes de `now`. */
export function saoPauloDayBefore(now: Date, daysBack: number): string {
  const today = saoPauloDay.format(now);
  const shifted = new Date(Date.parse(`${today}T00:00:00Z`) - daysBack * DAY_MS);
  return shifted.toISOString().slice(0, 10);
}

export interface JobResult {
  day: string;
  summaries: number;
  sent: number;
  failed: number;
  purged: { loginAttempts: number; readings: number };
}

/**
 * Job diário (idempotente): calcula o resumo do dia anterior, envia ao Telegram o que ainda
 * não foi enviado (inclui dias recentes cujo envio falhou) e apaga dados antigos.
 */
export async function runDailyReport(now: Date = new Date()): Promise<JobResult> {
  const day = saoPauloDayBefore(now, 1);
  const devices = await listDevices();
  const names = new Map(devices.map((d) => [d.id, d.name]));

  let summaries = 0;
  for (const device of devices) {
    if (await calculateDailySummary({ deviceId: device.id, day })) summaries += 1;
  }

  let sent = 0;
  let failed = 0;
  const since = new Date(`${saoPauloDayBefore(now, 1 + RETRY_DAYS)}T00:00:00Z`);
  for (const row of await repository.findUnsent(since)) {
    const text = formatDailySummary({
      deviceName: names.get(row.deviceId) ?? row.deviceId,
      day: row.day.toISOString().slice(0, 10),
      tempMinC: row.tempMinC,
      tempMaxC: row.tempMaxC,
      tempAvgC: row.tempAvgC,
      fanOnMinutes: row.fanOnMinutes,
      readingsCount: row.readingsCount,
    });
    try {
      await sendTelegram(text);
    } catch (err) {
      // telegram_sent_at fica vazio: a próxima execução tenta de novo.
      failed += 1;
      logger.warn(
        {
          deviceId: row.deviceId,
          day: row.day,
          reason: err instanceof Error ? err.message : "erro",
        },
        "resumo não enviado ao Telegram",
      );
      continue;
    }
    await repository.markSent(row.deviceId, row.day, new Date());
    sent += 1;
  }

  const attemptsBefore = new Date(now.getTime() - LOGIN_ATTEMPTS_DAYS * DAY_MS);
  const readingsBefore = new Date(now);
  readingsBefore.setUTCMonth(readingsBefore.getUTCMonth() - READINGS_MONTHS);
  const purged = {
    loginAttempts: await purgeLoginAttempts(attemptsBefore),
    // Anúncio de equipamento que não aparece há mais de 1 dia some (o ESP32 anuncia de novo).
    pairingAnnouncements: await purgeAnnouncements(new Date(now.getTime() - DAY_MS)),
    readings: await purgeBefore(readingsBefore),
  };

  const result = { day, summaries, sent, failed, purged };
  logger.info(
    { ...result, resumoEnviado: sent > 0 ? "sim" : "não" },
    "job diário concluído",
  );
  return result;
}
