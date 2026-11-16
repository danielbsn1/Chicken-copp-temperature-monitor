import type { Response } from "express";
import { pinoHttp } from "pino-http";
import { logger } from "../logger.js";

// O requestId é gravado em res.locals pelo middleware request-id.
const idOf = (res: object) => (res as Partial<Response>).locals?.requestId;

export const httpLogger = pinoHttp({
  logger,
  genReqId: (_req, res) => String(idOf(res) ?? ""),
  customProps: (_req, res) => ({ requestId: idOf(res) }),
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
});
