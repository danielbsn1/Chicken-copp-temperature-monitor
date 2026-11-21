import { waitUntil } from "@vercel/functions";
import { env } from "../../config/env.js";
import { logger } from "../../core/logger.js";
import { healthResponseSchema, type HealthResponse } from "./health.schemas.js";

const PING_TIMEOUT_MS = 3_000;

export function getStatus(): HealthResponse {
  return healthResponseSchema.parse({ status: "ok" });
}

/**
 * Avisa o Healthchecks que um lote chegou. Nunca lança: uma falha do Healthchecks
 * não pode derrubar a gravação do lote.
 */
export async function pingHealthchecks(fetchFn: typeof fetch = fetch): Promise<void> {
  try {
    const response = await fetchFn(env.HC_PING_URL, {
      signal: AbortSignal.timeout(PING_TIMEOUT_MS),
    });
    if (!response.ok) {
      logger.warn({ status: response.status }, "ping do Healthchecks recusado");
    }
  } catch (err) {
    // Só o tipo do erro: a mensagem do fetch pode trazer a URL de ping, que é um segredo.
    logger.warn(
      { reason: err instanceof Error ? err.name : "erro" },
      "falha ao avisar o Healthchecks",
    );
  }
}

/**
 * Dispara o ping sem segurar a resposta ao ESP32. Na Vercel, `waitUntil` mantém a função
 * viva até o ping terminar; fora dela, a promessa simplesmente roda em segundo plano.
 */
export function pingInBackground(): void {
  waitUntil(pingHealthchecks());
}
