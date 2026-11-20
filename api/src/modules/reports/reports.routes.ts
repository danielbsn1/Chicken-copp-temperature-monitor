import { Router } from "express";
import { requireUser } from "../../core/http/guards.js";
import { validate } from "../../core/http/validate.js";
import * as controller from "./reports.controller.js";
import { dailyQuery } from "./reports.schemas.js";

export const reportsRouter = Router();

reportsRouter.get(
  "/reports/daily",
  requireUser,
  validate({ query: dailyQuery }),
  controller.daily,
);
