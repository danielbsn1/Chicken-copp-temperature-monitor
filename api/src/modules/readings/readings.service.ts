import * as repository from "./readings.repository.js";
import type { NewReading, Tx } from "./readings.repository.js";

export type { NewReading, Tx };

/** Última leitura do dispositivo, ou null se ainda não há nenhuma. */
export function latestReading(deviceId: string) {
  return repository.findLatest(deviceId);
}

/** Grava as leituras sem duplicar; devolve quantas entraram. Aceita a transação do ingest. */
export function saveMany(rows: NewReading[], tx?: Tx): Promise<number> {
  return repository.createMany(rows, tx);
}
