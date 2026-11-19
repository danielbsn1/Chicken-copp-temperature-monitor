import { describe, expect, it } from "vitest";
import { createDeviceArgs, statusQuery } from "./devices.schemas.js";

describe("createDeviceArgs", () => {
  it("aceita id e nome (o nome pode ter espaços)", () => {
    expect(createDeviceArgs.parse(["galpao-1", "Galpão", "principal"])).toEqual({
      id: "galpao-1",
      name: "Galpão principal",
    });
  });

  it.each([[[]], [["galpao-1"]], [["Id Com Espaço", "nome"]], [["x".repeat(65), "n"]]])(
    "rejeita %j",
    (args) => {
      expect(createDeviceArgs.safeParse(args).success).toBe(false);
    },
  );
});

describe("statusQuery", () => {
  it("exige deviceId", () => {
    expect(statusQuery.safeParse({}).success).toBe(false);
    expect(statusQuery.parse({ deviceId: "g" })).toEqual({ deviceId: "g" });
  });
});
