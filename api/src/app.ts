import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./core/http/error-handler.js";
import { httpLogger } from "./core/http/http-logger.js";
import { requestId } from "./core/http/request-id.js";
import { authRouter } from "./modules/auth/index.js";
import { devicesRouter, requireOwnedDevice } from "./modules/devices/index.js";
import { eventsRouter } from "./modules/events/index.js";
import { healthRouter } from "./modules/health/index.js";
import { ingestRouter } from "./modules/ingest/index.js";
import { notificationsRouter } from "./modules/notifications/index.js";
import { pairingRouter } from "./modules/pairing/index.js";
import { readingsRouter } from "./modules/readings/index.js";
import { reportsRouter } from "./modules/reports/index.js";

/** Monta o app sem chamar listen: testes, servidor local e Vercel usam o mesmo app. */
export function createApp(): Express {
  const app = express();
  // Atrás do proxy da Vercel: `req.ip` passa a ser o IP real do cliente (usado no pareamento).
  app.set("trust proxy", 1);

  app.use(requestId);
  app.use(httpLogger);
  app.use(helmet());
  app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
  app.use(express.json({ limit: "100kb" }));

  // Toda rota com ?deviceId= só atende o dono do equipamento.
  app.use("/api", requireOwnedDevice);

  app.use(
    "/api",
    healthRouter,
    authRouter,
    devicesRouter,
    pairingRouter,
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
