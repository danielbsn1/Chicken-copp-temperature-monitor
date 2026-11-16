import { describe, expect, it } from "vitest";
import { notificationsRouter } from "./index.js";

describe("módulo notifications", () => {
  it("expõe o router pela interface pública", () => {
    expect(typeof notificationsRouter).toBe("function");
  });
});
