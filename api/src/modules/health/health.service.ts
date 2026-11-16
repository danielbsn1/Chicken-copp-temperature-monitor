import { env } from "../../config/env.js";
import { logger } from "../../core/logger.js";
import { healthResponseSchema, type HealthResponse } from "./health.schemas.js";

const PING_TIMEOUT_MS = 5_000;

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
    logger.warn({ err }, "falha ao avisar o Healthchecks");
  }
}
