import type { RequestHandler } from "express";
import { getStatus } from "./health.service.js";

export const getHealth: RequestHandler = (_req, res) => {
  res.status(200).json(getStatus());
};
