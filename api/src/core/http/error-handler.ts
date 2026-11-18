import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { AppError, NotFoundError } from "../errors.js";
import { logger } from "../logger.js";

interface ErrorBody {
  error: { code: string; message: string; details?: unknown[] };
}

function body(code: string, message: string, details?: unknown[]): ErrorBody {
  return { error: { code, message, ...(details ? { details } : {}) } };
}

/** Rota inexistente: vira NotFoundError e segue para o error-handler. */
export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new NotFoundError());
};

/** Último middleware: converte qualquer erro no formato padrão. */
export const errorHandler: ErrorRequestHandler = (err: unknown, req, res, _next) => {
  const log = req.log ?? logger;

  if (err instanceof AppError) {
    return res.status(err.status).json(body(err.code, err.message, err.details));
  }

  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
    }));
    return res.status(400).json(body("VALIDATION_ERROR", "Entrada inválida", details));
  }

  // Erros do body-parser (corpo grande demais ou JSON malformado).
  const type = (err as { type?: string } | null)?.type;
  if (type === "entity.too.large") {
    return res.status(413).json(body("PAYLOAD_TOO_LARGE", "Corpo maior que 100 KB"));
  }
  if (type === "entity.parse.failed") {
    return res.status(400).json(body("VALIDATION_ERROR", "JSON inválido"));
  }

  log.error({ err }, "erro não previsto");
  return res.status(500).json(body("INTERNAL_ERROR", "Erro interno"));
};
