import { Router } from "express";
import { requireUser } from "../../core/http/guards.js";
import { validate } from "../../core/http/validate.js";
import * as controller from "./auth.controller.js";
import { loginBody } from "./auth.schemas.js";

export const authRouter = Router();

authRouter.post("/auth/login", validate({ body: loginBody }), controller.login);
authRouter.post("/auth/logout", requireUser, controller.logout);
authRouter.get("/auth/me", requireUser, controller.me);
