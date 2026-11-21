import { Router } from "express";
import { requireCronSecret, requireUser } from "../../core/http/guards.js";
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

/** Único agendador: a Vercel chama às 10:00 UTC com Authorization: Bearer <CRON_SECRET>. */
reportsRouter.get("/jobs/daily-report", requireCronSecret, controller.dailyJob);
