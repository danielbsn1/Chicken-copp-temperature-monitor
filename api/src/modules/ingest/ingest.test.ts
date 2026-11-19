import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = { tx: true };
const runInTransaction = vi.hoisted(() => vi.fn());
const saveReadings = vi.hoisted(() => vi.fn());
const saveEvents = vi.hoisted(() => vi.fn());
const touch = vi.hoisted(() => vi.fn());
const setFirmware = vi.hoisted(() => vi.fn());
const ping = vi.hoisted(() => vi.fn());

vi.mock("./ingest.repository.js", () => ({ runInTransaction }));
vi.mock("../readings/index.js", () => ({ saveMany: saveReadings }));
vi.mock("../events/index.js", () => ({ saveMany: saveEvents }));
vi.mock("../devices/index.js", () => ({ touch, setFirmware }));
vi.mock("../health/index.js", () => ({ pingHealthchecks: ping }));

const { ingestBatch } = await import("./ingest.service.js");

const NOW = new Date("2026-11-18T12:00:30Z");
const at = (iso: string) => iso;
const sample = (over: Record<string, unknown> = {}) => ({
  ts: "2026-11-18T11:59:10Z",
  tempC: 25,
  humPct: 60,
  fanOn: false,
  ...over,
});
const event = (over: Record<string, unknown> = {}) => ({
  ts: "2026-11-18T11:58:10Z",
  type: "fan_on",
  detail: { tempC: 31 },
  ...over,
});
const batch = (samples: unknown[] = [], events: unknown[] = []) => ({
  deviceId: "dev-1",
  fwVersion: "1.2.0",
  samples,
  events,
});

beforeEach(() => {
  vi.resetAllMocks();
  runInTransaction.mockImplementation(async (fn: (t: unknown) => unknown) => fn(tx));
  saveReadings.mockImplementation(async (rows: unknown[]) => rows.length);
  saveEvents.mockImplementation(async (rows: unknown[]) => rows.length);
});

describe("ingestBatch: contagem", () => {
  it("lote válido: tudo aceito", async () => {
    const result = await ingestBatch("dev-1", batch([sample()], [event()]), NOW);
    expect(result).toEqual({ accepted: 2, duplicates: 0, rejected: 0 });
  });

  it("o que o banco ignorou conta como duplicado", async () => {
    saveReadings.mockResolvedValue(1);
    saveEvents.mockResolvedValue(0);
    const result = await ingestBatch(
      "dev-1",
      batch([sample(), sample({ ts: "2026-11-18T11:50:00Z" })], [event()]),
      NOW,
    );
    expect(result).toEqual({ accepted: 1, duplicates: 2, rejected: 0 });
  });

  it("lote vazio é válido", async () => {
    expect(await ingestBatch("dev-1", batch(), NOW)).toEqual({
      accepted: 0,
      duplicates: 0,
      rejected: 0,
    });
  });
});

describe("ingestBatch: janela de ts", () => {
  it.each([
    ["48 h atrás (limite)", at("2026-11-16T12:00:30Z"), true],
    ["mais de 48 h atrás", at("2026-11-16T12:00:29Z"), false],
    ["5 min à frente (limite)", at("2026-11-18T12:05:30Z"), true],
    ["mais de 5 min à frente", at("2026-11-18T12:05:31Z"), false],
  ])("amostra %s", async (_nome, ts, aceita) => {
    const result = await ingestBatch("dev-1", batch([sample({ ts })]), NOW);
    expect(result.rejected).toBe(aceita ? 0 : 1);
  });

  it("evento fora da janela é rejeitado", async () => {
    const result = await ingestBatch(
      "dev-1",
      batch([], [event({ ts: "2026-11-10T00:00:00Z" })]),
      NOW,
    );
    expect(result.rejected).toBe(1);
  });

  it("arredonda ts ao minuto (para baixo) em amostras e eventos", async () => {
    await ingestBatch(
      "dev-1",
      batch(
        [sample({ ts: "2026-11-18T11:59:59.900Z" })],
        [event({ ts: "2026-11-18T11:58:30Z" })],
      ),
      NOW,
    );
    expect(saveReadings.mock.calls[0]?.[0][0].ts).toEqual(
      new Date("2026-11-18T11:59:00Z"),
    );
    expect(saveEvents.mock.calls[0]?.[0][0].ts).toEqual(new Date("2026-11-18T11:58:00Z"));
  });
});

describe("ingestBatch: itens ruins não travam o lote", () => {
  it.each([
    ["tempC abaixo de -10", sample({ tempC: -10.1 })],
    ["tempC acima de 60", sample({ tempC: 60.1 })],
    ["humPct abaixo de 0", sample({ humPct: -1 })],
    ["humPct acima de 100", sample({ humPct: 100.5 })],
    ["tempC não numérico", sample({ tempC: "25" })],
    ["fanOn não booleano", sample({ fanOn: "sim" })],
    ["ts inválido", sample({ ts: "ontem" })],
    ["ts com fuso (não UTC)", sample({ ts: "2026-11-18T08:59:10-03:00" })],
    ["item que não é objeto", "lixo"],
  ])("amostra com %s é rejeitada e o resto é gravado", async (_nome, ruim) => {
    const result = await ingestBatch("dev-1", batch([ruim, sample()]), NOW);
    expect(result).toEqual({ accepted: 1, duplicates: 0, rejected: 1 });
    expect(saveReadings.mock.calls[0]?.[0]).toHaveLength(1);
  });

  it.each([-10, 60, 0, 100])("aceita os limites (%s)", async (v) => {
    const result = await ingestBatch(
      "dev-1",
      batch([sample({ tempC: v === 100 ? 60 : v })]),
      NOW,
    );
    expect(result.rejected).toBe(0);
  });

  it("evento de tipo desconhecido é rejeitado", async () => {
    const result = await ingestBatch(
      "dev-1",
      batch(
        [],
        [
          event({ type: "explodiu" }),
          event({ type: "boot", detail: { reason: "power_on" } }),
        ],
      ),
      NOW,
    );
    expect(result).toEqual({ accepted: 1, duplicates: 0, rejected: 1 });
  });

  it.each([
    "fan_on",
    "fan_off",
    "temp_critical",
    "sensor_failure",
    "sensor_recovered",
    "boot",
    "connectivity_restored",
  ])("aceita o tipo %s", async (type) => {
    const result = await ingestBatch(
      "dev-1",
      batch([], [event({ type, detail: undefined })]),
      NOW,
    );
    expect(result.rejected).toBe(0);
  });
});

describe("ingestBatch: gravação", () => {
  it("grava amostras, eventos, last_seen_at e fwVersion na mesma transação", async () => {
    await ingestBatch("dev-1", batch([sample()], [event()]), NOW);
    expect(runInTransaction).toHaveBeenCalledTimes(1);
    expect(saveReadings.mock.calls[0]?.[1]).toBe(tx);
    expect(saveEvents.mock.calls[0]?.[1]).toBe(tx);
    expect(touch).toHaveBeenCalledWith("dev-1", tx, NOW);
    expect(setFirmware).toHaveBeenCalledWith("dev-1", "1.2.0", tx);
  });

  it("grava as linhas com o deviceId autenticado", async () => {
    await ingestBatch("dev-1", batch([sample()], [event()]), NOW);
    expect(saveReadings.mock.calls[0]?.[0][0]).toMatchObject({
      deviceId: "dev-1",
      tempC: 25,
    });
    expect(saveEvents.mock.calls[0]?.[0][0]).toMatchObject({
      deviceId: "dev-1",
      type: "fan_on",
      detail: { tempC: 31 },
    });
  });

  it("mesmo sem itens novos atualiza last_seen_at e fwVersion", async () => {
    await ingestBatch("dev-1", batch(), NOW);
    expect(touch).toHaveBeenCalledOnce();
    expect(setFirmware).toHaveBeenCalledOnce();
  });

  it("se a gravação falha, o erro sobe e o Healthchecks não é avisado", async () => {
    saveEvents.mockRejectedValue(new Error("banco caiu"));
    await expect(ingestBatch("dev-1", batch([sample()], [event()]), NOW)).rejects.toThrow(
      "banco caiu",
    );
    expect(ping).not.toHaveBeenCalled();
  });

  it("avisa o Healthchecks depois de gravar", async () => {
    await ingestBatch("dev-1", batch([sample()]), NOW);
    expect(ping).toHaveBeenCalledOnce();
    expect(ping.mock.invocationCallOrder[0]).toBeGreaterThan(
      touch.mock.invocationCallOrder[0] ?? Infinity,
    );
  });

  it("rejeita lote cujo deviceId não é o do dispositivo autenticado", async () => {
    await expect(
      ingestBatch("outro-dispositivo", batch([sample()]), NOW),
    ).rejects.toMatchObject({ status: 401 });
    expect(runInTransaction).not.toHaveBeenCalled();
  });
});
