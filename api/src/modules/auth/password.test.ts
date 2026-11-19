import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password.js";

describe("password (scrypt)", () => {
  it("gera scrypt$sal$hash em hexadecimal, sem a senha em claro", async () => {
    const hash = await hashPassword("senha-bem-longa-123");
    expect(hash).toMatch(/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
    expect(hash).not.toContain("senha-bem-longa-123");
  });

  it("usa sal aleatório: a mesma senha gera hashes diferentes", async () => {
    const [a, b] = await Promise.all([
      hashPassword("mesma-senha-123"),
      hashPassword("mesma-senha-123"),
    ]);
    expect(a).not.toBe(b);
  });

  it("confere a senha certa e recusa a errada", async () => {
    const hash = await hashPassword("senha-certa-12345");
    expect(await verifyPassword("senha-certa-12345", hash)).toBe(true);
    expect(await verifyPassword("senha-errada-12345", hash)).toBe(false);
    expect(await verifyPassword("", hash)).toBe(false);
  });

  it.each([[""], ["texto-solto"], ["scrypt$zz$zz"], ["bcrypt$aa$bb"], ["scrypt$aa"]])(
    "hash malformado (%s) nunca confere e não lança",
    async (stored) => {
      expect(await verifyPassword("qualquer", stored)).toBe(false);
    },
  );
});
