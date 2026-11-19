import * as repository from "./events.repository.js";
import type { NewEvent, Tx } from "./events.repository.js";

export type { NewEvent, Tx };

/** Grava os eventos sem duplicar; devolve quantos entraram. Aceita a transação do ingest. */
export function saveMany(rows: NewEvent[], tx?: Tx): Promise<number> {
  return repository.createMany(rows, tx);
}
