import { describe, expect, it } from "vitest";
import { eventsRouter } from "./index.js";

describe("módulo events", () => {
  it("expõe o router pela interface pública", () => {
    expect(typeof eventsRouter).toBe("function");
  });
});
