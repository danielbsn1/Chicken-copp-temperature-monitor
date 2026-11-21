import { Router } from "express";
import { requireUser } from "../../core/http/guards.js";
import { validate } from "../../core/http/validate.js";
import * as controller from "./devices.controller.js";
import { statusQuery } from "./devices.schemas.js";

export const devicesRouter = Router();

devicesRouter.get(
  "/status",
  requireUser,
  validate({ query: statusQuery }),
  controller.status,
);

devicesRouter.get("/devices", requireUser, controller.list);
