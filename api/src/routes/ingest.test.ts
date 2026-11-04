import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { hashKey } from "../lib/device-key.js";
import { prisma } from "../lib/prisma.js";

const DEVICE_ID = "test-ingest";
const KEY = "chave-de-teste";
const headers = { "x-device-key": KEY };

const baseMinute = Math.floor(Date.now() / 60_000) * 60 - 600;
const sample = (minute: number) => ({
  ts: baseMinute + minute * 60,
  temp_c: 29.4,
  hum_pct: 61.2,
  fan_on: false,
});

async function clean() {
  await prisma().reading.deleteMany({ where: { deviceId: DEVICE_ID } });
  await prisma().event.deleteMany({ where: { deviceId: DEVICE_ID } });
}

describe("POST /api/ingest", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  const post = (
    payload: Record<string, unknown>,
    h: Record<string, string> = headers,
  ) => app.inject({ method: "POST", url: "/api/ingest", headers: h, payload });

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    await prisma().device.upsert({
      where: { id: DEVICE_ID },
      create: { id: DEVICE_ID, name: "Teste", keyHash: hashKey(KEY) },
      update: { keyHash: hashKey(KEY) },
    });
  });

  beforeEach(clean);

  afterAll(async () => {
    await clean();
    await prisma().device.delete({ where: { id: DEVICE_ID } });
    await app.close();
    await prisma().$disconnect();
  });

  it("grava amostras e eventos", async () => {
    const res = await post({
      device_id: DEVICE_ID,
      fw: "1.0.0",
      samples: [sample(0), sample(1)],
      events: [{ ts: baseMinute, type: "FAN_ON", detail: { temp_c: 30.1 } }],
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ accepted: 3, duplicates: 0 });
  });

  it("não duplica quando o lote é reenviado", async () => {
    const payload = { device_id: DEVICE_ID, samples: [sample(0), sample(1)] };
    await post(payload);
    const res = await post(payload);
    expect(res.json()).toEqual({ accepted: 0, duplicates: 2 });
  });

  it("atualiza last_seen_at e a versão do firmware", async () => {
    await post({ device_id: DEVICE_ID, fw: "1.2.3" });
    const device = await prisma().device.findUniqueOrThrow({
      where: { id: DEVICE_ID },
    });
    expect(device.fwVersion).toBe("1.2.3");
    expect(device.lastSeenAt).not.toBeNull();
  });

  it("recusa chave errada com 401", async () => {
    const res = await post(
      { device_id: DEVICE_ID, samples: [sample(0)] },
      { "x-device-key": "errada" },
    );
    expect(res.statusCode).toBe(401);
  });

  it("recusa requisição sem chave com 401", async () => {
    const res = await post({ device_id: DEVICE_ID }, {});
    expect(res.statusCode).toBe(401);
  });

  it("recusa dispositivo desconhecido com 401", async () => {
    const res = await post({ device_id: "nao-existe" });
    expect(res.statusCode).toBe(401);
  });

  it("recusa lote com mais de 100 amostras com 400", async () => {
    const samples = Array.from({ length: 101 }, (_, i) => sample(i));
    const res = await post({ device_id: DEVICE_ID, samples });
    expect(res.statusCode).toBe(400);
  });

  it("recusa ts fora da janela com 400", async () => {
    const old = Math.floor(Date.now() / 1000) - 3 * 24 * 60 * 60;
    const res = await post({
      device_id: DEVICE_ID,
      samples: [{ ...sample(0), ts: old }],
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("invalid_timestamp");
  });
});
