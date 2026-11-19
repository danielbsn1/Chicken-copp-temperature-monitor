// Payloads do contrato do POST /api/ingest, usados pelos testes de integração.
// Os instantes são relativos a "agora" para ficarem sempre dentro da janela aceita.

export const minutesAgo = (minutes: number, now = Date.now()): string =>
  new Date(now - minutes * 60_000).toISOString();

export const validSample = (minutes: number, over: Record<string, unknown> = {}) => ({
  ts: minutesAgo(minutes),
  tempC: 25.5,
  humPct: 61,
  fanOn: false,
  ...over,
});

export const validEvent = (minutes: number, over: Record<string, unknown> = {}) => ({
  ts: minutesAgo(minutes),
  type: "fan_on",
  detail: { tempC: 31 },
  ...over,
});

/** Lote válido: 2 amostras e 1 evento, em minutos distintos. */
export function validBatch(deviceId: string, over: Record<string, unknown> = {}) {
  return {
    deviceId,
    fwVersion: "2.0.1",
    samples: [validSample(10), validSample(9, { tempC: 26, fanOn: true })],
    events: [validEvent(8)],
    ...over,
  };
}

/** Itens inválidos (cada um deve entrar em `rejected`, sem derrubar o lote). */
export const invalidSamples = {
  tsNaoIso: validSample(1, { ts: "ontem" }),
  tsForaDeUtc: validSample(1, { ts: "2026-01-01T10:00:00-03:00" }),
  tsMuitoAntigo: validSample(1, { ts: minutesAgo(48 * 60 + 5) }),
  tsNoFuturo: validSample(1, { ts: minutesAgo(-10) }),
  tempAcimaDe60: validSample(1, { tempC: 60.5 }),
  tempAbaixoDeMenos10: validSample(1, { tempC: -10.5 }),
  umidadeAcimaDe100: validSample(1, { humPct: 100.5 }),
  umidadeAbaixoDe0: validSample(1, { humPct: -0.5 }),
};

export const invalidEvents = {
  tipoDesconhecido: validEvent(1, { type: "explodiu" }),
  tsNaoIso: validEvent(1, { ts: "amanhã" }),
};

export const items = <T>(count: number, make: (i: number) => T): T[] =>
  Array.from({ length: count }, (_, i) => make(i));

/** Corpo com mais de 100 KB (o app limita o JSON a 100 KB). */
export function oversizedBatch(deviceId: string) {
  return validBatch(deviceId, {
    events: [validEvent(5, { detail: { enchimento: "x".repeat(110 * 1024) } })],
  });
}
