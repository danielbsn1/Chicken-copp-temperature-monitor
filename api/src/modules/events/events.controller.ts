import type { RequestHandler } from "express";
import type { ListQuery } from "./events.schemas.js";
import * as service from "./events.service.js";

export const list: RequestHandler = async (req, res) => {
  res.json(await service.listEvents(req.query as unknown as ListQuery));
};
