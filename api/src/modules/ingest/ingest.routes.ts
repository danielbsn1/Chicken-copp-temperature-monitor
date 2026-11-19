import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { RateLimitError } from "../../core/errors.js";
import { validate } from "../../core/http/validate.js";
import { requireDeviceKey } from "../devices/index.js";
import * as controller from "./ingest.controller.js";
import { batchSchema } from "./ingest.schemas.js";

export const ingestRouter = Router();

// 30 requisições por minuto por dispositivo (roda depois da autenticação).
const perDeviceLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  keyGenerator: (_req, res) => res.locals.deviceId as string,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => next(new RateLimitError()),
});

ingestRouter.post(
  "/ingest",
  requireDeviceKey,
  perDeviceLimit,
  validate({ body: batchSchema }),
  controller.ingest,
);
