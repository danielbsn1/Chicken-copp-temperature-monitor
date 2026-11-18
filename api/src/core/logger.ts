import type { DestinationStream } from "pino";
import { pino } from "pino";
import { env } from "../config/env.js";

const SECRET_FIELDS = [
  "password",
  "token",
  "secret",
  "key",
  "deviceKey",
  "keyHash",
  "sessionSecret",
];

export const REDACTED_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  'req.headers["x-device-key"]',
  'res.headers["set-cookie"]',
  ...SECRET_FIELDS,
  ...SECRET_FIELDS.map((field) => `*.${field}`),
];

export function createLogger(level: string, stream?: DestinationStream) {
  return pino({ level, redact: { paths: REDACTED_PATHS, censor: "[redigido]" } }, stream);
}

export const logger = createLogger(env.NODE_ENV === "test" ? "silent" : "info");
