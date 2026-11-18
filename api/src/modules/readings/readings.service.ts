import * as repository from "./readings.repository.js";

/** Última leitura do dispositivo, ou null se ainda não há nenhuma. */
export function latestReading(deviceId: string) {
  return repository.findLatest(deviceId);
}
