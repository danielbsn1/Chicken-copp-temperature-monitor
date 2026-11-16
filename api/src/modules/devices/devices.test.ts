import { describe, expect, it } from "vitest";
import { devicesRouter } from "./index.js";

describe("módulo devices", () => {
  it("expõe o router pela interface pública", () => {
    expect(typeof devicesRouter).toBe("function");
  });
});
