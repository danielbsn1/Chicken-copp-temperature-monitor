import { describe, expect, it } from "vitest";
import { readingsRouter } from "./index.js";

describe("módulo readings", () => {
  it("expõe o router pela interface pública", () => {
    expect(typeof readingsRouter).toBe("function");
  });
});
