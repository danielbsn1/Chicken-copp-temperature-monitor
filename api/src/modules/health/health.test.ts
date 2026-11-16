import { afterEach, describe, expect, it, vi } from "vitest";
import { getStatus, pingHealthchecks } from "./health.service.js";

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
});
