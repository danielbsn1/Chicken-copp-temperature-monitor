import type { IncomingMessage, ServerResponse } from "node:http";
import { env } from "../src/config/env.js";
import { db } from "../src/core/db.js";

// SPIKE (descartável). O cliente `db` vive fora do manipulador, uma vez por processo.
const bootedAt = Date.now();
let invocations = 0;

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (req.headers.authorization !== `Bearer ${env.CRON_SECRET}`) {
    res.statusCode = 401;
    res.end();
    return;
  }
  const cold = invocations++ === 0;
  const run = `probe-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const t0 = performance.now();
  try {
    const inserted = await db.poolerProbe.create({ data: { nonce: `${run}-single` } });
    const selected = await db.poolerProbe.findUnique({ where: { id: inserted.id } });
    const tInsertSelect = performance.now() - t0;

    const nonces = [`${run}-a`, `${run}-b`, `${run}-a`].map((nonce) => ({ nonce }));
    const [first, second] = await db.$transaction(
      [
        db.poolerProbe.createMany({ data: nonces, skipDuplicates: true }),
        db.poolerProbe.createMany({ data: nonces, skipDuplicates: true }),
      ],
      { maxWait: 15_000, timeout: 15_000 },
    );
    const total = performance.now() - t0;

    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify({
        cold,
        processAgeMs: Date.now() - bootedAt,
        insertSelectOk: selected?.nonce === inserted.nonce,
        createManyFirst: first.count,
        createManySecond: second.count,
        insertSelectMs: Math.round(tInsertSelect),
        totalMs: Math.round(total),
      }),
    );
  } catch (error) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : "erro" }));
  }
}
