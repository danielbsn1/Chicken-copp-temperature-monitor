import { createHash } from "node:crypto";
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { signSession } from "../../core/session.js";
import { errorHandler } from "../../core/http/error-handler.js";

interface Row {
  id: string;
  name: string;
  keyHash: string;
  lastSeenAt: Date | null;
  fwVersion: string | null;
}

const store = vi.hoisted(() => ({
  rows: new Map<string, unknown>(),
  touches: [] as unknown[][],
  firmwares: [] as unknown[][],
}));
const rows = store.rows as Map<string, Row>;

vi.mock("./devices.repository.js", () => ({
  listKeyHashes: async () =>
    [...rows.values()].map((r) => ({ id: r.id, keyHash: r.keyHash })),
  findById: async (id: string) => rows.get(id) ?? null,
  save: async (id: string, name: string, keyHash: string) => {
    const old = rows.get(id);
    rows.set(id, {
      id,
      name,
      keyHash,
      lastSeenAt: old?.lastSeenAt ?? null,
      fwVersion: old?.fwVersion ?? null,
    });
  },
  touch: async (...args: unknown[]) => {
    store.touches.push(args);
  },
  setFirmware: async (...args: unknown[]) => {
    store.firmwares.push(args);
  },
}));

const latestReading = vi.hoisted(() => vi.fn());
vi.mock("../readings/index.js", () => ({
  readingsRouter: {},
  latestReading,
}));

const {
  authenticate,
  generateKey,
  getStatus,
  hashKey,
  registerDevice,
  setFirmware,
  touch,
} = await import("./devices.service.js");
const { devicesRouter } = await import("./index.js");

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

beforeEach(() => {
  rows.clear();
  store.touches.length = 0;
  store.firmwares.length = 0;
  latestReading.mockReset();
});

describe("chave do dispositivo", () => {
  it("tem 32 bytes aleatórios (64 hex) e nunca repete", () => {
    const a = generateKey();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(generateKey()).not.toBe(a);
  });

  it("o hash é SHA-256 em hexadecimal", () => {
    expect(hashKey("abc")).toBe(sha256("abc"));
  });
});

describe("registerDevice", () => {
  it("cadastra dispositivo novo guardando só o hash", async () => {
    const result = await registerDevice("galpao-1", "Galpão 1");
    expect(result.created).toBe(true);
    expect(rows.get("galpao-1")?.keyHash).toBe(sha256(result.key));
    expect(JSON.stringify([...rows.values()])).not.toContain(result.key);
  });

  it("para dispositivo existente gera outra chave e invalida a anterior", async () => {
    const first = await registerDevice("galpao-1", "Galpão 1");
    const second = await registerDevice("galpao-1", "Galpão 1");
    expect(second.created).toBe(false);
    expect(second.key).not.toBe(first.key);
    expect(await authenticate(first.key)).toBeNull();
    expect(await authenticate(second.key)).toEqual({ id: "galpao-1" });
  });
});

describe("authenticate", () => {
  it("aceita a chave válida de entre vários dispositivos", async () => {
    await registerDevice("a", "A");
    const b = await registerDevice("b", "B");
    expect(await authenticate(b.key)).toEqual({ id: "b" });
  });

  it.each([["chave-errada"], [""], ["0".repeat(64)]])(
    "rejeita chave inválida (%s)",
    async (key) => {
      await registerDevice("a", "A");
      expect(await authenticate(key)).toBeNull();
    },
  );

  it("rejeita quando não há dispositivo cadastrado", async () => {
    expect(await authenticate("qualquer")).toBeNull();
  });
});

describe("touch", () => {
  it("repassa o id, a transação e o instante ao repositório", async () => {
    const tx = { tx: true };
    const at = new Date("2026-11-18T10:00:00Z");
    await touch("galpao-1", tx as never, at);
    expect(store.touches).toEqual([["galpao-1", at, tx]]);
  });

  it("usa o instante atual quando não recebe nenhum", async () => {
    await touch("galpao-1");
    expect(store.touches[0]?.[1]).toBeInstanceOf(Date);
  });
});

describe("setFirmware", () => {
  it("repassa o id, a versão e a transação ao repositório", async () => {
    const tx = { tx: true };
    await setFirmware("galpao-1", "1.2.0", tx as never);
    expect(store.firmwares).toEqual([["galpao-1", "1.2.0", tx]]);
  });
});

describe("getStatus", () => {
  it("junta a última leitura com lastSeenAt e fwVersion", async () => {
    const lastSeenAt = new Date("2026-11-18T10:00:00Z");
    rows.set("g", {
      id: "g",
      name: "G",
      keyHash: "h",
      lastSeenAt,
      fwVersion: "1.2.0",
    });
    const ts = new Date("2026-11-18T09:59:00Z");
    latestReading.mockResolvedValue({ ts, tempC: 27.5, humPct: 60, fanOn: true });
    expect(await getStatus("g")).toEqual({
      reading: { ts, tempC: 27.5, humPct: 60, fanOn: true },
      fanOn: true,
      lastSeenAt,
      fwVersion: "1.2.0",
    });
  });

  it("sem leituras, devolve reading e fanOn nulos", async () => {
    rows.set("g", {
      id: "g",
      name: "G",
      keyHash: "h",
      lastSeenAt: null,
      fwVersion: null,
    });
    latestReading.mockResolvedValue(null);
    expect(await getStatus("g")).toEqual({
      reading: null,
      fanOn: null,
      lastSeenAt: null,
      fwVersion: null,
    });
  });

  it("dispositivo inexistente lança NotFoundError", async () => {
    await expect(getStatus("nada")).rejects.toMatchObject({ status: 404 });
  });
});

describe("GET /api/status", () => {
  function app() {
    const a = express();
    a.use("/api", devicesRouter);
    a.use(errorHandler);
    return a;
  }
  const cookie = () => `session=${signSession("u-1")}`;

  it("exige o cookie de sessão", async () => {
    const res = await request(app()).get("/api/status?deviceId=g");
    expect(res.status).toBe(401);
  });

  it("exige deviceId", async () => {
    const res = await request(app()).get("/api/status").set("Cookie", cookie());
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("responde 404 para dispositivo inexistente", async () => {
    const res = await request(app())
      .get("/api/status?deviceId=nada")
      .set("Cookie", cookie());
    expect(res.status).toBe(404);
  });

  it("responde 200 com o status", async () => {
    rows.set("g", {
      id: "g",
      name: "G",
      keyHash: "h",
      lastSeenAt: null,
      fwVersion: "1.0",
    });
    latestReading.mockResolvedValue(null);
    const res = await request(app())
      .get("/api/status?deviceId=g")
      .set("Cookie", cookie());
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      reading: null,
      fanOn: null,
      lastSeenAt: null,
      fwVersion: "1.0",
    });
  });
});
