import { prisma } from "../lib/prisma.js";
import { touchDevice } from "../repositories/devices.js";
import { insertEvents } from "../repositories/events.js";
import { insertReadings } from "../repositories/readings.js";
import type { IngestBody } from "../schemas/ingest.js";

const MAX_PAST_MS = 48 * 60 * 60 * 1000;
const MAX_FUTURE_MS = 5 * 60 * 1000;
const MINUTE_MS = 60_000;

export class InvalidTimestampError extends Error {}

function toDate(ts: number, now: Date): Date {
  const ms = ts * 1000;
  if (ms < now.getTime() - MAX_PAST_MS || ms > now.getTime() + MAX_FUTURE_MS) {
    throw new InvalidTimestampError(`ts fora da janela permitida: ${ts}`);
  }
  return new Date(ms);
}

export async function ingest(body: IngestBody, now = new Date()) {
  const samples = body.samples.map((s) => ({
    ts: new Date(
      Math.floor(toDate(s.ts, now).getTime() / MINUTE_MS) * MINUTE_MS,
    ),
    tempC: s.temp_c,
    humPct: s.hum_pct,
    fanOn: s.fan_on,
  }));
  const events = body.events.map((e) => ({
    ts: toDate(e.ts, now),
    type: e.type,
    detail: e.detail,
  }));

  return prisma().$transaction(async (tx) => {
    const insertedSamples = await insertReadings(tx, body.device_id, samples);
    const insertedEvents = await insertEvents(tx, body.device_id, events);
    await touchDevice(tx, body.device_id, body.fw);

    const accepted = insertedSamples + insertedEvents;
    return { accepted, duplicates: samples.length + events.length - accepted };
  });
}
