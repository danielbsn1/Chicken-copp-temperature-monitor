import { describe, expect, it } from "vitest";
import { announceBody, claimBody, signupBody } from "./pairing.schemas.js";
import { deviceIdFrom, ipGroup } from "./pairing.service.js";

describe("ipGroup (mesma rede)", () => {
  it("IPv4 fica como está", () => {
    expect(ipGroup("203.0.113.7")).toBe("203.0.113.7");
  });

  it("IPv4 dentro de IPv6 vira IPv4", () => {
    expect(ipGroup("::ffff:203.0.113.7")).toBe("203.0.113.7");
  });

  it("IPv6 agrupa pelo /64: aparelho e navegador no mesmo prefixo coincidem", () => {
    const device = ipGroup("2001:db8:abcd:12:aaaa:bbbb:cccc:dddd");
    const browser = ipGroup("2001:0db8:abcd:0012::1");
    expect(device).toBe("2001:db8:abcd:12::/64");
    expect(browser).toBe(device);
  });

  it("IPv6 de prefixos diferentes não coincide", () => {
    expect(ipGroup("2001:db8:abcd:13::1")).not.toBe(ipGroup("2001:db8:abcd:12::1"));
  });

  it("ignora a zona (%eth0)", () => {
    expect(ipGroup("fe80::1%eth0")).toBe(ipGroup("fe80::1"));
  });
});

describe("deviceIdFrom", () => {
  it("tira acentos, usa hífen e acrescenta o sufixo", () => {
    expect(deviceIdFrom("Galinheiro da Maria", "ab12")).toBe("galinheiro-da-maria-ab12");
    expect(deviceIdFrom("Granja São José!", "ab12")).toBe("granja-sao-jose-ab12");
  });

  it("nome sem letras ou números usa 'galinheiro'", () => {
    expect(deviceIdFrom("!!!", "ab12")).toBe("galinheiro-ab12");
  });

  it("nome longo respeita o limite de 64 caracteres do id", () => {
    expect(deviceIdFrom("a".repeat(100), "ab12").length).toBeLessThanOrEqual(64);
  });
});

describe("schemas do pareamento", () => {
  const key = "a".repeat(64);

  it("anúncio válido tem serial, chave de 64 hex e botão opcional", () => {
    const parsed = announceBody.parse({
      serial: "AVT-0001-XYZ",
      key,
      fwVersion: "2.0.1",
    });
    expect(parsed.button).toBe(false);
  });

  it("recusa serial curto, chave que não é hexadecimal e versão vazia", () => {
    expect(announceBody.safeParse({ serial: "curto", key, fwVersion: "1" }).success).toBe(
      false,
    );
    expect(
      announceBody.safeParse({
        serial: "AVT-0001-XYZ",
        key: "z".repeat(64),
        fwVersion: "1",
      }).success,
    ).toBe(false);
    expect(
      announceBody.safeParse({ serial: "AVT-0001-XYZ", key, fwVersion: "" }).success,
    ).toBe(false);
  });

  it("vínculo exige nome; manual começa falso", () => {
    expect(claimBody.safeParse({ serial: "AVT-0001-XYZ", name: "  " }).success).toBe(
      false,
    );
    expect(claimBody.parse({ serial: "AVT-0001-XYZ", name: " Meu " })).toMatchObject({
      name: "Meu",
      manual: false,
    });
  });

  it("cadastro normaliza o e-mail e exige senha de 12 caracteres", () => {
    const base = { serial: "AVT-0001-XYZ", name: "Meu" };
    expect(
      signupBody.parse({
        ...base,
        email: " Ana@Example.COM ",
        password: "senha-bem-longa",
      }).email,
    ).toBe("ana@example.com");
    expect(
      signupBody.safeParse({ ...base, email: "ana@example.com", password: "curta" })
        .success,
    ).toBe(false);
  });
});
