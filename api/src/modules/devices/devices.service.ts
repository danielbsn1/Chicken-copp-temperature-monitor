import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { NotFoundError } from "../../core/errors.js";
import { latestReading } from "../readings/index.js";
import * as repository from "./devices.repository.js";

export function generateKey(): string {
  return randomBytes(32).toString("hex");
}

export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Acha o dispositivo dono da chave. Compara o hash em tempo constante com todos
 * os dispositivos, sem parar no primeiro acerto.
 */
export async function authenticate(key: string): Promise<{ id: string } | null> {
  const presented = Buffer.from(hashKey(key), "hex");
  let found: string | null = null;
  for (const device of await repository.listKeyHashes()) {
    const stored = Buffer.from(device.keyHash, "hex");
    if (stored.length === presented.length && timingSafeEqual(stored, presented)) {
      found = device.id;
    }
  }
  return found === null ? null : { id: found };
}

/** Cadastra o dispositivo ou troca a chave dele; a chave em claro só volta aqui. */
export async function registerDevice(id: string, name: string) {
  const exists = (await repository.findById(id)) !== null;
  const key = generateKey();
  await repository.save(id, name, hashKey(key));
  return { created: !exists, key };
}

export function touch(
  deviceId: string,
  tx?: repository.Tx,
  seenAt = new Date(),
): Promise<void> {
  return repository.touch(deviceId, seenAt, tx);
}

export function setFirmware(
  deviceId: string,
  fwVersion: string,
  tx?: repository.Tx,
): Promise<void> {
  return repository.setFirmware(deviceId, fwVersion, tx);
}

export async function getStatus(deviceId: string) {
  const device = await repository.findById(deviceId);
  if (!device) throw new NotFoundError("Dispositivo não encontrado");
  const reading = await latestReading(deviceId);
  return {
    reading,
    fanOn: reading?.fanOn ?? null,
    lastSeenAt: device.lastSeenAt,
    fwVersion: device.fwVersion,
  };
}
