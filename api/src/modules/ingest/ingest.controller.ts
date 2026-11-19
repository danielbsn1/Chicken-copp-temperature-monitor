import type { RequestHandler } from "express";
import { logger } from "../../core/logger.js";
import type { Batch } from "./ingest.schemas.js";
import * as service from "./ingest.service.js";

export const ingest: RequestHandler = async (req, res) => {
  const deviceId = res.locals.deviceId as string;
  const result = await service.ingestBatch(deviceId, req.body as Batch);
  logger.info({ requestId: res.locals.requestId, deviceId, ...result }, "lote recebido");
  res.json(result);
};
