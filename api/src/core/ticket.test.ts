import { describe, expect, it } from "vitest";
import { signTicket, verifyTicket } from "./ticket.js";

const NOW = new Date("2026-11-21T12:00:00Z");
const LATER = NOW.getTime() + 5 * 60 * 1000;

describe("bilhete de pareamento", () => {
  it("vale para o serial e antes de vencer", () => {
    const ticket = signTicket("AVT-0001-XYZ", LATER);
    expect(verifyTicket("AVT-0001-XYZ", ticket, NOW)).toBe(true);
  });

  it("não vale para outro serial", () => {
    const ticket = signTicket("AVT-0001-XYZ", LATER);
    expect(verifyTicket("AVT-0002-ABC", ticket, NOW)).toBe(false);
  });

  it("vencido não vale (o instante do vencimento já é tarde)", () => {
    const ticket = signTicket("AVT-0001-XYZ", LATER);
    expect(verifyTicket("AVT-0001-XYZ", ticket, new Date(LATER))).toBe(false);
    expect(verifyTicket("AVT-0001-XYZ", ticket, new Date(LATER + 1))).toBe(false);
  });

  it("trocar o vencimento ou a assinatura invalida", () => {
    const [, sig] = signTicket("AVT-0001-XYZ", LATER).split(".");
    expect(verifyTicket("AVT-0001-XYZ", `${LATER + 60000}.${sig}`, NOW)).toBe(false);
    expect(verifyTicket("AVT-0001-XYZ", `${LATER}.${"A".repeat(43)}`, NOW)).toBe(false);
  });

  it.each(["", "abc", "123.curta", `${LATER}`, "x.y.z"])("lixo %j não vale", (junk) => {
    expect(verifyTicket("AVT-0001-XYZ", junk, NOW)).toBe(false);
  });
});
