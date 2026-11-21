import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { db } from "../../core/db.js";
import { isDatabaseReady } from "../../test-utils/db-ready.js";
import { removeTestUser, testUser } from "../../test-utils/owner.test-helper.js";
import { PAIRING_WINDOW_MS } from "./pairing.service.js";

// Pareamento contra um Postgres real: anúncio, mesma rede, botão, vínculo e posse.
const dbReady = await isDatabaseReady(() => db.device.count());

const SERIAL = "AVT-CONTRATO-0001";
const SERIAL_2 = "AVT-CONTRATO-0002";
const KEY = "a".repeat(64);
const EMAIL = "contrato-pareamento@example.com";
const EMAIL_2 = "contrato-pareamento-2@example.com";
const NEW_EMAIL = "contrato-novo@example.com";
const PASSWORD = "senha-bem-longa-123";
const IP = "203.0.113.10";
const OTHER_IP = "198.51.100.20";

describe.skipIf(!dbReady)("pareamento (Postgres real)", () => {
  const app = createApp();
  let cookie = "";
  let cookie2 = "";

  // `X-Forwarded-For` vale porque o app confia no proxy (trust proxy = 1).
  const announce = (body: object, ip = IP) =>
    request(app)
      .post("/api/pairing/announce")
      .set("X-Forwarded-For", ip)
      .send({ serial: SERIAL, key: KEY, fwVersion: "2.0.1", ...body });
  const available = (ip = IP) =>
    request(app).get("/api/pairing/available").set("X-Forwarded-For", ip);
  const claim = (body: object, ip = IP, who = cookie) =>
    request(app)
      .post("/api/pairing/claim")
      .set("X-Forwarded-For", ip)
      .set("Cookie", who)
      .send({ serial: SERIAL, name: "Galinheiro da Ana", ...body });

  async function clean() {
    const users = await db.user.findMany({
      where: { email: { in: [EMAIL, EMAIL_2, NEW_EMAIL] } },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    await db.pairingAnnouncement.deleteMany({
      where: { serial: { in: [SERIAL, SERIAL_2] } },
    });
    await db.device.deleteMany({ where: { ownerId: { in: ids } } });
    for (const email of [EMAIL, EMAIL_2, NEW_EMAIL]) await removeTestUser(email);
  }

  beforeAll(async () => {
    await clean();
    cookie = (await testUser(EMAIL)).cookie;
    cookie2 = (await testUser(EMAIL_2)).cookie;
  });
  beforeEach(async () => {
    await db.pairingAnnouncement.deleteMany({
      where: { serial: { in: [SERIAL, SERIAL_2] } },
    });
    await db.device.deleteMany({ where: { name: "Galinheiro da Ana" } });
    await removeTestUser(NEW_EMAIL);
  });
  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  it("sem apertar o botão o equipamento espera e não aparece na lista", async () => {
    const res = await announce({});
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "waiting", pairing: false });
    expect((await available()).body.devices).toEqual([]);
  });

  it("com o botão apertado aparece só para quem está no mesmo IP", async () => {
    const res = await announce({ button: true });
    expect(res.body).toEqual({ status: "waiting", pairing: true });

    const same = await available();
    expect(same.body.devices).toHaveLength(1);
    expect(same.body.devices[0]).toMatchObject({ serial: SERIAL, fwVersion: "2.0.1" });
    expect((await available(OTHER_IP)).body.devices).toEqual([]);
  });

  it("a janela de pareamento fecha depois de 5 minutos", async () => {
    await announce({ button: true });
    await db.pairingAnnouncement.update({
      where: { serial: SERIAL },
      data: { pairingUntil: new Date(Date.now() - 1000) },
    });
    expect((await available()).body.devices).toEqual([]);
    expect(PAIRING_WINDOW_MS).toBe(5 * 60 * 1000);
  });

  it("vincular cria o equipamento do usuário com a chave do próprio aparelho", async () => {
    await announce({ button: true });
    const res = await claim({});
    expect(res.status).toBe(201);
    expect(res.body.deviceId).toMatch(/^galinheiro-da-ana-[0-9a-f]{4}$/);

    const device = await db.device.findUnique({ where: { id: res.body.deviceId } });
    expect(device?.name).toBe("Galinheiro da Ana");
    expect(device?.keyHash).toHaveLength(64);
    expect(device?.keyHash).not.toBe(KEY); // só o hash fica gravado

    // o aparelho, ao anunciar de novo, descobre que já tem dono
    const again = await announce({});
    expect(again.body).toEqual({ status: "claimed", deviceId: res.body.deviceId });
    expect((await available()).body.devices).toEqual([]);
  });

  it("a chave gravada serve no envio de lotes (X-Device-Key)", async () => {
    await announce({ button: true });
    const { deviceId } = (await claim({})).body;
    const res = await request(app)
      .post("/api/ingest")
      .set("X-Device-Key", KEY)
      .send({ deviceId, samples: [] });
    expect(res.status).not.toBe(401);
  });

  it("vincular de outra rede responde 404; manual com o serial da etiqueta vale", async () => {
    await announce({ button: true });
    expect((await claim({}, OTHER_IP)).status).toBe(404);
    expect((await claim({ manual: true }, OTHER_IP)).status).toBe(201);
  });

  it("sem o botão apertado o vínculo responde 409 PAIRING_CLOSED", async () => {
    await announce({});
    const res = await claim({});
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("PAIRING_CLOSED");
  });

  it("serial desconhecido responde 404 e sem sessão 401", async () => {
    expect((await claim({ serial: "AVT-NAO-EXISTE-1" })).status).toBe(404);
    const res = await request(app)
      .post("/api/pairing/claim")
      .send({ serial: SERIAL, name: "x" });
    expect(res.status).toBe(401);
  });

  it("dois usuários não levam o mesmo equipamento", async () => {
    await announce({ button: true });
    expect((await claim({})).status).toBe(201);
    expect((await claim({}, IP, cookie2)).status).toBe(404);
  });

  it("equipamento zerado (chave nova) volta a esperar dono", async () => {
    await announce({ button: true });
    await claim({});
    const res = await announce({ key: "b".repeat(64), button: true });
    expect(res.body).toEqual({ status: "waiting", pairing: true });
  });

  it("cadastro cria a conta e já vincula o primeiro equipamento", async () => {
    await announce({ button: true });
    const res = await request(app)
      .post("/api/pairing/signup")
      .set("X-Forwarded-For", IP)
      .send({
        serial: SERIAL,
        name: "Galinheiro da Ana",
        email: NEW_EMAIL,
        password: PASSWORD,
      });
    expect(res.status).toBe(201);
    const user = await db.user.findUnique({ where: { email: NEW_EMAIL } });
    const device = await db.device.findUnique({ where: { id: res.body.deviceId } });
    expect(device?.ownerId).toBe(user?.id);
  });

  it("cadastro com e-mail que já existe responde 409 e não troca a senha", async () => {
    await announce({ button: true });
    const before = await db.user.findUnique({ where: { email: EMAIL } });
    const res = await request(app)
      .post("/api/pairing/signup")
      .set("X-Forwarded-For", IP)
      .send({ serial: SERIAL, name: "x", email: EMAIL, password: PASSWORD });
    expect(res.status).toBe(409);
    expect((await db.user.findUnique({ where: { email: EMAIL } }))?.passwordHash).toBe(
      before?.passwordHash,
    );
  });

  it("cadastro com equipamento inválido não deixa conta criada", async () => {
    const res = await request(app)
      .post("/api/pairing/signup")
      .set("X-Forwarded-For", IP)
      .send({ serial: SERIAL_2, name: "x", email: NEW_EMAIL, password: PASSWORD });
    expect(res.status).toBe(404);
    expect(await db.user.findUnique({ where: { email: NEW_EMAIL } })).toBeNull();
  });

  it("anúncio inválido responde 400", async () => {
    expect((await announce({ key: "curta" })).status).toBe(400);
  });
});

describe.skipIf(!dbReady)("posse do equipamento (Postgres real)", () => {
  const app = createApp();
  const MINE = "contrato-posse-meu";
  const THEIRS = "contrato-posse-alheio";
  const A = "contrato-posse-a@example.com";
  const B = "contrato-posse-b@example.com";
  let cookieA = "";

  beforeAll(async () => {
    await db.device.deleteMany({ where: { id: { in: [MINE, THEIRS] } } });
    const a = await testUser(A);
    const b = await testUser(B);
    cookieA = a.cookie;
    await db.device.createMany({
      data: [
        { id: MINE, name: "Meu", keyHash: "x", ownerId: a.id },
        { id: THEIRS, name: "Alheio", keyHash: "y", ownerId: b.id },
      ],
    });
  });
  afterAll(async () => {
    await db.device.deleteMany({ where: { id: { in: [MINE, THEIRS] } } });
    await removeTestUser(A);
    await removeTestUser(B);
    await db.$disconnect();
  });

  it("GET /api/devices lista só os equipamentos do usuário", async () => {
    const res = await request(app).get("/api/devices").set("Cookie", cookieA);
    expect(res.status).toBe(200);
    expect(res.body.devices.map((d: { id: string }) => d.id)).toEqual([MINE]);
  });

  it("equipamento de outra pessoa responde 404 em status, leituras, eventos e relatório", async () => {
    for (const path of ["status", "readings", "events", "reports/daily"]) {
      const res = await request(app)
        .get(`/api/${path}?deviceId=${THEIRS}`)
        .set("Cookie", cookieA);
      expect(res.status, path).toBe(404);
    }
  });

  it("o seu próprio equipamento responde normalmente", async () => {
    const res = await request(app)
      .get(`/api/status?deviceId=${MINE}`)
      .set("Cookie", cookieA);
    expect(res.status).toBe(200);
  });

  it("sem sessão continua 401", async () => {
    expect((await request(app).get(`/api/status?deviceId=${MINE}`)).status).toBe(401);
  });
});
