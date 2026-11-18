import { describe, expect, it } from "vitest";
import { authRouter } from "./index.js";

describe("módulo auth", () => {
  it("expõe o router pela interface pública", () => {
    expect(typeof authRouter).toBe("function");
  });
});
