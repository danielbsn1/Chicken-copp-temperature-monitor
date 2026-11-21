import type { RequestHandler } from "express";
import type { DailyQuery } from "./reports.schemas.js";
import * as service from "./reports.service.js";

export const daily: RequestHandler = async (req, res) => {
  const { deviceId, day, format } = req.query as unknown as DailyQuery;
  const summary = await service.dailySummary({ deviceId, day });
  if (format === "csv") {
    res.attachment(`resumo-${deviceId}-${day}.csv`);
    res.type("text/csv; charset=utf-8");
    res.send(service.summaryToCsv(summary));
    return;
  }
  res.json(summary);
};

export const dailyJob: RequestHandler = async (_req, res) => {
  res.json(await service.runDailyReport());
};
