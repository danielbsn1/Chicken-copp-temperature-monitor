import type { RequestHandler } from "express";
import * as service from "./devices.service.js";

export const status: RequestHandler = async (req, res) => {
  const { deviceId } = req.query as { deviceId: string };
  res.json(await service.getStatus(deviceId));
};
