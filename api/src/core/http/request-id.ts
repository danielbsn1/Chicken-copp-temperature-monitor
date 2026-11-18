import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

const VALID_ID = /^[A-Za-z0-9._-]{1,64}$/;

/** Repassa o X-Request-Id recebido (se for seguro) ou gera um novo. */
export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.header("x-request-id");
  const id = incoming && VALID_ID.test(incoming) ? incoming : randomUUID();
  res.locals.requestId = id;
  res.setHeader("X-Request-Id", id);
  next();
};
