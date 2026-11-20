import { Router } from "express";
import { requireUser } from "../../core/http/guards.js";
import { validate } from "../../core/http/validate.js";
import * as controller from "./readings.controller.js";
import { seriesQuery } from "./readings.schemas.js";

export const readingsRouter = Router();

readingsRouter.get(
  "/readings",
  requireUser,
  validate({ query: seriesQuery }),
  controller.series,
);
