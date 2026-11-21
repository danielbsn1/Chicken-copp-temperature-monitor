import { describe, expect, it } from "vitest";
import { sessionSchema } from "./auth.schemas";

describe("sessionSchema", () => {
  it("aceita id e e-mail", () => {
    expect(sessionSchema.safeParse({ id: "u1", email: "a@b.com" }).success).toBe(true);
  });

  it("recusa sessão sem e-mail", () => {
    expect(sessionSchema.safeParse({ id: "u1" }).success).toBe(false);
  });
});
