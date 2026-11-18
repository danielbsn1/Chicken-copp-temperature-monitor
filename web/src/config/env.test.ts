import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkEnv, env, EnvError, parseEnv } from "./env";

describe("parseEnv", () => {
  it("aceita as duas variáveis e tira a barra final da URL", () => {
    expect(
      parseEnv({ VITE_API_URL: "https://api.exemplo.com/api/", VITE_DEVICE_ID: "g1" }),
    ).toEqual({ apiUrl: "https://api.exemplo.com/api", deviceId: "g1" });
  });

  it("falha citando o nome da variável que falta", () => {
    expect(() => parseEnv({ VITE_API_URL: "https://api.exemplo.com/api" })).toThrow(
      /VITE_DEVICE_ID/,
    );
    expect(() => parseEnv({ VITE_DEVICE_ID: "g1" })).toThrow(EnvError);
  });

  it("falha com URL inválida sem revelar o valor", () => {
    try {
      parseEnv({ VITE_API_URL: "valor-ruim", VITE_DEVICE_ID: "g1" });
      expect.unreachable();
    } catch (err) {
      expect((err as Error).message).toContain("VITE_API_URL");
      expect((err as Error).message).not.toContain("valor-ruim");
    }
  });
});

describe("env do ambiente de teste", () => {
  it("expõe apiUrl e deviceId e checkEnv não acusa problemas", () => {
    expect(env.apiUrl).toBe("http://localhost:3333/api");
    expect(env.deviceId).toBe("galinheiro-teste");
    expect(checkEnv()).toBeNull();
  });
});

describe(".env.example", () => {
  it("só tem variáveis VITE_* e nenhuma com cara de segredo (elas são públicas)", () => {
    const names = readFileSync(".env.example", "utf8")
      .split("\n")
      .filter((line) => /^[A-Z_]+=/.test(line))
      .map((line) => line.split("=")[0] ?? "");
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      expect(name.startsWith("VITE_")).toBe(true);
      expect(name).not.toMatch(/SECRET|TOKEN|KEY|PASSWORD|PASS/);
    }
  });
});
