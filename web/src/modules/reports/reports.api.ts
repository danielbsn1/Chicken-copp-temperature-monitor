import { env } from "../../config/env";
import { http } from "../../shared/api/http";
import { dailySchema, type DailySummary } from "./reports.schemas";

/** Resumo já gravado do dia (AAAA-MM-DD); 404 quando o dia não tem resumo. */
export function getDailySummary(
  day: string,
  signal?: AbortSignal,
): Promise<DailySummary> {
  return http(
    "/reports/daily",
    { query: { deviceId: env.deviceId, day }, signal },
    dailySchema,
  );
}

/** Endereço do CSV do dia: o navegador baixa direto, com o cookie de sessão. */
export function dailyCsvUrl(day: string): string {
  const url = new URL(`${env.apiUrl}/reports/daily`);
  url.searchParams.set("deviceId", env.deviceId);
  url.searchParams.set("day", day);
  url.searchParams.set("format", "csv");
  return url.toString();
}
