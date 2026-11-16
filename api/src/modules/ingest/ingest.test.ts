import { describe, expect, it } from "vitest";
import { ingestRouter } from "./index.js";

describe("módulo ingest", () => {
  it("expõe o router pela interface pública", () => {
    expect(typeof ingestRouter).toBe("function");
  });
});
