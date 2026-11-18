import { describe, expect, it } from "vitest";
import { reportsRouter } from "./index.js";

describe("módulo reports", () => {
  it("expõe o router pela interface pública", () => {
    expect(typeof reportsRouter).toBe("function");
  });
});
