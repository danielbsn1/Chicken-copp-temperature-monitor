import * as repository from "./events.repository.js";
import type { NewEvent, Tx } from "./events.repository.js";
import type { ListQuery } from "./events.schemas.js";

export type { NewEvent, Tx };

/** Grava os eventos sem duplicar; devolve quantos entraram. Aceita a transação do ingest. */
export function saveMany(rows: NewEvent[], tx?: Tx): Promise<number> {
  return repository.createMany(rows, tx);
}

/** Eventos do mais novo para o mais antigo, já prontos para o painel. */
export async function listEvents(query: ListQuery) {
  const rows = await repository.findMany(query);
  return {
    deviceId: query.deviceId,
    events: rows.map((row) => ({
      ts: row.ts.toISOString(),
      type: row.type,
      detail: row.detail,
    })),
  };
}
