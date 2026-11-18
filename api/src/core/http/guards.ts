import { timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";
import { env } from "../../config/env.js";
import { UnauthorizedError } from "../errors.js";

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Protege o job diário: exige `Authorization: Bearer <CRON_SECRET>`. */
export const requireCronSecret: RequestHandler = (req, _res, next) => {
  const header = req.header("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  if (!token || !safeEqual(token, env.CRON_SECRET)) {
    return next(new UnauthorizedError("Credencial inválida"));
  }
  next();
};
