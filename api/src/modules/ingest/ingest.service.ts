import { UnauthorizedError } from "../../core/errors.js";
import * as devices from "../devices/index.js";
import * as events from "../events/index.js";
import { pingHealthchecks } from "../health/index.js";
import * as readings from "../readings/index.js";
import {
  eventSchema,
  sampleSchema,
  type Batch,
  type IngestResult,
} from "./ingest.schemas.js";
import { runInTransaction } from "./ingest.repository.js";

const MAX_AGE_MS = 48 * 60 * 60 * 1000;
const MAX_AHEAD_MS = 5 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

function inWindow(ts: Date, now: Date): boolean {
  const diff = ts.getTime() - now.getTime();
  return diff >= -MAX_AGE_MS && diff <= MAX_AHEAD_MS;
}

function floorToMinute(ts: Date): Date {
  return new Date(Math.floor(ts.getTime() / MINUTE_MS) * MINUTE_MS);
}

/** Valida cada item e o enquadra na janela de ts. O que falhar só incrementa `rejected`. */
function accept<T extends { ts: string }>(
  items: unknown[],
  parse: (item: unknown) => T | null,
  now: Date,
): { valid: (Omit<T, "ts"> & { ts: Date })[]; rejected: number } {
  const valid: (Omit<T, "ts"> & { ts: Date })[] = [];
  for (const item of items) {
    const parsed = parse(item);
    const ts = parsed ? new Date(parsed.ts) : null;
    if (parsed && ts && inWindow(ts, now)) {
      valid.push({ ...parsed, ts: floorToMinute(ts) });
    }
  }
  return { valid, rejected: items.length - valid.length };
}

/**
 * Grava o lote do dispositivo numa única transação e devolve as contagens.
 * Reenviar o mesmo lote é seguro: o que já existe vira `duplicates`.
 */
export async function ingestBatch(
  authenticatedDeviceId: string,
  batch: Batch,
  now = new Date(),
): Promise<IngestResult> {
  if (batch.deviceId !== authenticatedDeviceId) {
    throw new UnauthorizedError("Credencial inválida");
  }
  const deviceId = authenticatedDeviceId;

  const samples = accept(
    batch.samples,
    (item) => {
      const result = sampleSchema.safeParse(item);
      return result.success ? result.data : null;
    },
    now,
  );
  const evts = accept(
    batch.events,
    (item) => {
      const result = eventSchema.safeParse(item);
      return result.success ? result.data : null;
    },
    now,
  );

  const saved = await runInTransaction(async (tx) => {
    const insertedSamples = await readings.saveMany(
      samples.valid.map((s) => ({ ...s, deviceId })),
      tx,
    );
    const insertedEvents = await events.saveMany(
      evts.valid.map((e) => ({ ...e, deviceId })),
      tx,
    );
    await devices.touch(deviceId, tx, now);
    await devices.setFirmware(deviceId, batch.fwVersion, tx);
    return insertedSamples + insertedEvents;
  });

  await pingHealthchecks();

  const valid = samples.valid.length + evts.valid.length;
  return {
    accepted: saved,
    duplicates: valid - saved,
    rejected: samples.rejected + evts.rejected,
  };
}
