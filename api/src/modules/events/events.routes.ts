import { Router } from "express";
import { requireUser } from "../../core/http/guards.js";
import { validate } from "../../core/http/validate.js";
import * as controller from "./events.controller.js";
import { listQuery } from "./events.schemas.js";

export const eventsRouter = Router();

eventsRouter.get("/events", requireUser, validate({ query: listQuery }), controller.list);
