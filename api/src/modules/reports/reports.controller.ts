import type { RequestHandler } from "express";
import type { DailyQuery } from "./reports.schemas.js";
import * as service from "./reports.service.js";

export const daily: RequestHandler = async (req, res) => {
  res.json(await service.dailySummary(req.query as unknown as DailyQuery));
};
