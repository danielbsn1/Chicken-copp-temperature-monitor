import { Prisma } from "../../generated/prisma/client.js";
import { db } from "../../core/db.js";
import type { Bucket } from "./readings.schemas.js";

export type Tx = Prisma.TransactionClient;

export interface NewReading {
  deviceId: string;
  ts: Date;
  tempC: number;
  humPct: number;
  fanOn: boolean;
}

export interface BucketRow {
  bucket: Date;
  minC: number;
  avgC: number;
  maxC: number;
}

const INTERVAL: Record<Bucket, string> = {
  "1m": "1 minute",
  "5m": "5 minutes",
  "15m": "15 minutes",
  "1h": "1 hour",
};

export function findLatest(deviceId: string) {
  return db.reading.findFirst({
    where: { deviceId },
    orderBy: { ts: "desc" },
    select: { ts: true, tempC: true, humPct: true, fanOn: true },
  });
}

/** Grava ignorando as linhas que já existem (chave primária); devolve quantas entraram. */
export async function createMany(rows: NewReading[], tx?: Tx): Promise<number> {
  if (rows.length === 0) return 0;
  const result = await (tx ?? db).reading.createMany({
    data: rows,
    skipDuplicates: true,
  });
  return result.count;
}

/**
 * Agrega a temperatura por bucket alinhado ao relógio (origem 1970-01-01 UTC).
 * Filtra por device_id e ts, ou seja, pela chave primária (device_id, ts).
 */
export function aggregate(
  deviceId: string,
  from: Date,
  to: Date,
  bucket: Bucket,
): Promise<BucketRow[]> {
  return db.$queryRaw<BucketRow[]>(Prisma.sql`
    SELECT date_bin(${INTERVAL[bucket]}::interval, ts, TIMESTAMPTZ '1970-01-01 00:00:00+00') AS bucket,
           MIN(temp_c)::float8 AS "minC",
           AVG(temp_c)::float8 AS "avgC",
           MAX(temp_c)::float8 AS "maxC"
    FROM readings
    WHERE device_id = ${deviceId} AND ts >= ${from} AND ts < ${to}
    GROUP BY 1
    ORDER BY 1`);
}
