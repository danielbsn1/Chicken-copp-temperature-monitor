import { delay, http as mswHttp, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { API, server } from "../test/server";
import { ApiError } from "./errors";
import { http, setUnauthorizedHandler } from "./http";

const itemSchema = z.object({ id: z.number() });

afterEach(() => setUnauthorizedHandler(undefined));

describe("http", () => {
  it("devolve a resposta validada e envia o cookie (credentials: include)", async () => {
    server.use(mswHttp.get(`${API}/item`, () => HttpResponse.json({ id: 7 })));
    const spy = vi.spyOn(globalThis, "fetch");
    await expect(http("/item", {}, itemSchema)).resolves.toEqual({ id: 7 });
    expect(spy.mock.calls[0]?.[1]).toMatchObject({ credentials: "include" });
    spy.mockRestore();
  });

  it("monta a query ignorando valores indefinidos", async () => {
    let search = "";
    server.use(
      mswHttp.get(`${API}/item`, ({ request }) => {
        search = new URL(request.url).search;
        return HttpResponse.json({ id: 1 });
      }),
    );
    await http("/item", { query: { a: 1, b: undefined, c: "x" } }, itemSchema);
    expect(search).toBe("?a=1&c=x");
  });

  it("envia o corpo como JSON no POST e aceita 204", async () => {
    let received: unknown;
    server.use(
      mswHttp.post(`${API}/acao`, async ({ request }) => {
        received = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    await expect(
      http("/acao", { method: "POST", body: { a: 1 } }, z.undefined()),
    ).resolves.toBeUndefined();
    expect(received).toEqual({ a: 1 });
  });

  it("converte o erro da API em ApiError com code, message e details", async () => {
    server.use(
      mswHttp.get(`${API}/item`, () =>
        HttpResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Entrada inválida",
              details: [{ a: 1 }],
            },
          },
          { status: 400 },
        ),
      ),
    );
    const err = await http("/item", {}, itemSchema).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({
      status: 400,
      code: "VALIDATION_ERROR",
      details: [{ a: 1 }],
    });
  });

  it("erro sem o formato padrão vira HTTP_ERROR", async () => {
    server.use(
      mswHttp.get(`${API}/item`, () => new HttpResponse("falha", { status: 502 })),
    );
    await expect(http("/item", {}, itemSchema)).rejects.toMatchObject({
      status: 502,
      code: "HTTP_ERROR",
    });
  });

  it("chama o handler de 401, mas só nele", async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    server.use(
      mswHttp.get(`${API}/item`, () =>
        HttpResponse.json(
          { error: { code: "UNAUTHORIZED", message: "x" } },
          { status: 401 },
        ),
      ),
      mswHttp.get(`${API}/outro`, () =>
        HttpResponse.json(
          { error: { code: "NOT_FOUND", message: "x" } },
          { status: 404 },
        ),
      ),
    );
    await expect(http("/item", {}, itemSchema)).rejects.toMatchObject({ status: 401 });
    expect(handler).toHaveBeenCalledOnce();
    await expect(http("/outro", {}, itemSchema)).rejects.toMatchObject({ status: 404 });
    expect(handler).toHaveBeenCalledOnce();
  });

  it("resposta fora do contrato vira ApiError INVALID_RESPONSE", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    server.use(
      mswHttp.get(`${API}/item`, () => HttpResponse.json({ id: "não é número" })),
    );
    await expect(http("/item", {}, itemSchema)).rejects.toMatchObject({
      status: 500,
      code: "INVALID_RESPONSE",
    });
  });

  it("falha de rede vira NETWORK_ERROR", async () => {
    server.use(mswHttp.get(`${API}/item`, () => HttpResponse.error()));
    await expect(http("/item", {}, itemSchema)).rejects.toMatchObject({
      status: 0,
      code: "NETWORK_ERROR",
    });
  });

  it("estouro do tempo vira TIMEOUT", async () => {
    server.use(
      mswHttp.get(`${API}/item`, async () => {
        await delay("infinite");
        return HttpResponse.json({ id: 1 });
      }),
    );
    await expect(http("/item", { timeoutMs: 50 }, itemSchema)).rejects.toMatchObject({
      status: 0,
      code: "TIMEOUT",
    });
  });
});
