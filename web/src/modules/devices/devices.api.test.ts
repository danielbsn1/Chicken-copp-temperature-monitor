import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { API, server } from "../../shared/test/server";
import { getAvailable } from "./devices.api";

const V4 = "http://127.0.0.1:3333/api";
const dev = (serial: string, ticket: string) => ({
  serial,
  fwVersion: "2.0.1",
  expiresAt: null,
  ticket,
});
const list = (...devices: ReturnType<typeof dev>[]) => HttpResponse.json({ devices });
const down = () =>
  HttpResponse.json({ error: { code: "X", message: "x" } }, { status: 500 });

describe("getAvailable", () => {
  it("sem endereço IPv4 pergunta só na API do painel", async () => {
    server.use(http.get(`${API}/pairing/available`, () => list(dev("A", "t1"))));
    expect((await getAvailable(undefined, undefined)).devices).toEqual([dev("A", "t1")]);
  });

  it("com endereço IPv4 junta o que cada lado achou, sem repetir o serial", async () => {
    server.use(
      http.get(`${API}/pairing/available`, () =>
        list(dev("A", "via-api"), dev("B", "via-api")),
      ),
      http.get(`${V4}/pairing/available`, () =>
        list(dev("B", "via-v4"), dev("C", "via-v4")),
      ),
    );
    const { devices } = await getAvailable(undefined, V4);
    expect(devices.map((d) => d.serial).sort()).toEqual(["A", "B", "C"]);
    // no serial repetido vale a resposta da API do painel (a última a entrar)
    expect(devices.find((d) => d.serial === "B")?.ticket).toBe("via-api");
  });

  it("se um dos lados falha, usa o outro", async () => {
    server.use(
      http.get(`${API}/pairing/available`, down),
      http.get(`${V4}/pairing/available`, () => list(dev("C", "via-v4"))),
    );
    expect((await getAvailable(undefined, V4)).devices).toEqual([dev("C", "via-v4")]);

    server.use(
      http.get(`${API}/pairing/available`, () => list(dev("A", "via-api"))),
      http.get(`${V4}/pairing/available`, down),
    );
    expect((await getAvailable(undefined, V4)).devices).toEqual([dev("A", "via-api")]);
  });

  it("se os dois falham, devolve o erro", async () => {
    server.use(
      http.get(`${API}/pairing/available`, down),
      http.get(`${V4}/pairing/available`, down),
    );
    await expect(getAvailable(undefined, V4)).rejects.toMatchObject({ status: 500 });
  });

  it("o servidor IPv4 não recebe o cookie de sessão", async () => {
    server.use(
      http.get(`${API}/pairing/available`, () => list()),
      http.get(`${V4}/pairing/available`, () => list()),
    );
    const spy = vi.spyOn(globalThis, "fetch");
    await getAvailable(undefined, V4);
    const sent = spy.mock.calls.map(([url, init]) => [String(url), init?.credentials]);
    spy.mockRestore();
    expect(sent).toContainEqual([`${API}/pairing/available`, "include"]);
    expect(sent).toContainEqual([`${V4}/pairing/available`, "omit"]);
  });
});
