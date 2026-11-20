import type { RequestHandler } from "express";
import type { SeriesQuery } from "./readings.schemas.js";
import * as service from "./readings.service.js";

export const series: RequestHandler = async (req, res) => {
  res.json(await service.temperatureSeries(req.query as unknown as SeriesQuery));
};
