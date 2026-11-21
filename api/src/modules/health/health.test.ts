import { afterEach, describe, expect, it, vi } from "vitest";
import { getStatus, pingHealthchecks, pingInBackground } from "./health.service.js";

describe("health.service", () => {
  afterEach(() => vi.restoreAllMocks());

  it("getStatus responde ok", () => {
    expect(getStatus()).toEqual({ status: "ok" });
  });

  it("pingHealthchecks chama a URL configurada", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("OK", { status: 200 }));
    await pingHealthchecks(fetchFn);
    expect(fetchFn).toHaveBeenCalledOnce();
    expect(String(fetchFn.mock.calls[0]?.[0])).toContain("hc-ping.test");
  });

  it("pingHealthchecks não lança quando o serviço recusa", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("erro", { status: 500 }));
    await expect(pingHealthchecks(fetchFn)).resolves.toBeUndefined();
  });

  it("pingHealthchecks não lança quando a rede falha", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error("sem rede"));
    await expect(pingHealthchecks(fetchFn)).resolves.toBeUndefined();
  });

  it("o log da falha não traz a URL de ping nem a mensagem do erro", async () => {
    const { logger } = await import("../../core/logger.js");
    const warn = vi.spyOn(logger, "warn");
    const url = "https://hc-ping.test/00000000-0000-0000-0000-000000000000";
    const fetchFn = vi.fn().mockRejectedValue(new Error(`falhou ${url}`));
    await pingHealthchecks(fetchFn);
    expect(JSON.stringify(warn.mock.calls)).not.toContain("hc-ping.test");
  });

  it("usa timeout curto (3 s) no ping", async () => {
    const spy = vi.spyOn(AbortSignal, "timeout");
    await pingHealthchecks(vi.fn().mockResolvedValue(new Response("OK")));
    expect(spy).toHaveBeenCalledWith(3000);
  });

  it("pingInBackground não lança nem espera o ping terminar", async () => {
    let finish: () => void = () => undefined;
    const slow = new Promise<Response>((resolve) => {
      finish = () => resolve(new Response("OK"));
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => slow),
    );
    const startedAt = Date.now();
    expect(() => pingInBackground()).not.toThrow();
    expect(Date.now() - startedAt).toBeLessThan(100);
    finish();
    vi.unstubAllGlobals();
  });
});
