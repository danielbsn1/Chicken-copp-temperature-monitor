import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";

describe("app", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /health responde ok", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });

  it("o OpenAPI descreve /health", () => {
    const spec = app.swagger() as { paths: Record<string, unknown> };
    expect(spec.paths["/health"]).toBeDefined();
  });
});
