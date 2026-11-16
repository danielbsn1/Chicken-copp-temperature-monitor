import { pino } from "pino";
import { env } from "../config/env.js";

export const REDACTED_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  'req.headers["x-device-key"]',
  'res.headers["set-cookie"]',
];

export const logger = pino({
  level: env.NODE_ENV === "test" ? "silent" : "info",
  redact: { paths: REDACTED_PATHS, censor: "[redigido]" },
});
