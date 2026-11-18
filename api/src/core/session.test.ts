import { describe, expect, it } from "vitest";
import { signSession, verifySession } from "./session.js";

describe("session", () => {
  it("assina e verifica o id do usuário", () => {
    const token = signSession("user-1");
    expect(verifySession(token)).toEqual({ userId: "user-1" });
  });

  it("rejeita assinatura adulterada", () => {
    const [payload] = signSession("user-1").split(".");
    expect(verifySession(`${payload}.assinatura-falsa`)).toBeNull();
  });

  it("rejeita payload trocado com a assinatura original", () => {
    const [, sig] = signSession("user-1").split(".");
    const outro = signSession("user-2").split(".")[0];
    expect(verifySession(`${outro}.${sig}`)).toBeNull();
  });

  it("rejeita sessão expirada", () => {
    const token = signSession("user-1", new Date("2026-01-01T00:00:00Z"));
    expect(verifySession(token, new Date("2026-01-09T00:00:00Z"))).toBeNull();
  });

  it("aceita sessão dentro dos 7 dias", () => {
    const token = signSession("user-1", new Date("2026-01-01T00:00:00Z"));
    expect(verifySession(token, new Date("2026-01-07T23:00:00Z"))).toEqual({
      userId: "user-1",
    });
  });

  it.each([[""], ["sem-ponto"], ["a.b.c"], ["!!!.???"]])("rejeita lixo (%s)", (t) => {
    expect(verifySession(t)).toBeNull();
  });
});
