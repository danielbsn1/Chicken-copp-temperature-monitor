import { z, type ZodType } from "zod";
import { env } from "../../config/env";
import { ApiError } from "./errors";

const TIMEOUT_MS = 15_000;

export interface HttpOptions {
  method?: "GET" | "POST";
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  signal?: AbortSignal;
  /** Servidor alternativo (sem cookie de sessão); o padrão é a API do painel. */
  baseUrl?: string;
  /** Só para testes; o padrão é 15 s. */
  timeoutMs?: number;
}

type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | undefined;

/** O app/ registra aqui o que fazer ao receber 401 (limpar o cache e ir para o login). */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | undefined): void {
  onUnauthorized = handler;
}

const errorBodySchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.array(z.unknown()).optional(),
  }),
});

function buildUrl(path: string, query: HttpOptions["query"], baseUrl?: string): string {
  const url = new URL(`${baseUrl ?? env.apiUrl}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url.toString();
}

/** Cliente HTTP único: JSON, cookie de sessão, timeout de 15 s, resposta validada e ApiError em qualquer falha. */
export async function http<T>(
  path: string,
  options: HttpOptions,
  schema: ZodType<T>,
): Promise<T> {
  const timeout = AbortSignal.timeout(options.timeoutMs ?? TIMEOUT_MS);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query, options.baseUrl), {
      method: options.method ?? "GET",
      // Outro servidor não recebe o cookie de sessão.
      credentials: options.baseUrl ? "omit" : "include",
      headers:
        options.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal,
    });
  } catch (err) {
    if (timeout.aborted)
      throw new ApiError(0, "TIMEOUT", "O servidor demorou para responder");
    if (options.signal?.aborted) throw err;
    throw new ApiError(0, "NETWORK_ERROR", "Sem conexão com o servidor");
  }

  if (!response.ok) {
    const parsed = errorBodySchema.safeParse(await response.json().catch(() => null));
    if (response.status === 401) onUnauthorized?.();
    throw parsed.success
      ? new ApiError(
          response.status,
          parsed.data.error.code,
          parsed.data.error.message,
          parsed.data.error.details,
        )
      : new ApiError(response.status, "HTTP_ERROR", `Erro ${response.status}`);
  }

  const payload: unknown =
    response.status === 204 ? undefined : await response.json().catch(() => undefined);
  const result = schema.safeParse(payload);
  if (!result.success) {
    if (import.meta.env.DEV)
      console.error("Resposta fora do contrato:", path, result.error);
    throw new ApiError(500, "INVALID_RESPONSE", "Resposta inesperada do servidor");
  }
  return result.data;
}
