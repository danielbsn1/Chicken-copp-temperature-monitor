import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./core/http/error-handler.js";
import { httpLogger } from "./core/http/http-logger.js";
import { requestId } from "./core/http/request-id.js";
import { authRouter } from "./modules/auth/index.js";
import { devicesRouter } from "./modules/devices/index.js";
import { eventsRouter } from "./modules/events/index.js";
import { healthRouter } from "./modules/health/index.js";
import { ingestRouter } from "./modules/ingest/index.js";
import { notificationsRouter } from "./modules/notifications/index.js";
import { readingsRouter } from "./modules/readings/index.js";
import { reportsRouter } from "./modules/reports/index.js";

/** Monta o app sem chamar listen: testes, servidor local e Vercel usam o mesmo app. */
export function createApp(): Express {
  const app = express();

  app.use(requestId);
  app.use(httpLogger);
  app.use(helmet());
  app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
  app.use(express.json({ limit: "100kb" }));

  app.use(
    "/api",
    healthRouter,
    authRouter,
    devicesRouter,
    ingestRouter,
    readingsRouter,
    eventsRouter,
    reportsRouter,
    notificationsRouter,
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
