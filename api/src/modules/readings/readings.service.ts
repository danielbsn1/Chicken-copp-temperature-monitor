import * as repository from "./readings.repository.js";
import type { NewReading, Tx } from "./readings.repository.js";
import type { SeriesQuery } from "./readings.schemas.js";

export type { NewReading, Tx };

/** Última leitura do dispositivo, ou null se ainda não há nenhuma. */
export function latestReading(deviceId: string) {
  return repository.findLatest(deviceId);
}

/** Grava as leituras sem duplicar; devolve quantas entraram. Aceita a transação do ingest. */
export function saveMany(rows: NewReading[], tx?: Tx): Promise<number> {
  return repository.createMany(rows, tx);
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Série de temperatura (mínima, média e máxima) por bucket; buckets sem leitura não aparecem. */
export async function temperatureSeries({ deviceId, from, to, bucket }: SeriesQuery) {
  const rows = await repository.aggregate(deviceId, from, to, bucket);
  return {
    deviceId,
    from: from.toISOString(),
    to: to.toISOString(),
    bucket,
    points: rows.map((row) => ({
      ts: row.bucket.toISOString(),
      minC: round2(row.minC),
      avgC: round2(row.avgC),
      maxC: round2(row.maxC),
    })),
  };
}
