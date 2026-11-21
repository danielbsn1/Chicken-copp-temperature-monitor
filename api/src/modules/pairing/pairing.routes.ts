import { Router } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { RateLimitError } from "../../core/errors.js";
import { requireUser } from "../../core/http/guards.js";
import { validate } from "../../core/http/validate.js";
import * as controller from "./pairing.controller.js";
import { announceBody, claimBody, signupBody } from "./pairing.schemas.js";

export const pairingRouter = Router();

/** Limite por IP; estoura em 429 no formato padrão. */
const perIp = (windowMs: number, limit: number) =>
  rateLimit({
    windowMs,
    limit,
    keyGenerator: (req) => ipKeyGenerator(req.ip ?? ""),
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, _res, next) => next(new RateLimitError()),
  });

const MINUTE = 60 * 1000;

// O ESP32 se anuncia a cada poucos segundos enquanto espera; 60 por minuto sobra.
pairingRouter.post(
  "/pairing/announce",
  perIp(MINUTE, 60),
  validate({ body: announceBody }),
  controller.announce,
);
pairingRouter.get("/pairing/available", perIp(MINUTE, 60), controller.available);
pairingRouter.post(
  "/pairing/claim",
  perIp(MINUTE, 10),
  requireUser,
  validate({ body: claimBody }),
  controller.claim,
);
// Cadastro aberto: limite baixo por IP.
pairingRouter.post(
  "/pairing/signup",
  perIp(60 * MINUTE, 10),
  validate({ body: signupBody }),
  controller.signup,
);
