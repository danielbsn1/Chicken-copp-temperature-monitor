import { describe, expect, it } from "vitest";
import { eventLabel } from "./event-labels";

describe("eventLabel", () => {
  it.each([
    ["fan_on", "Ventilador ligado"],
    ["fan_off", "Ventilador desligado"],
    ["temp_critical", "Temperatura crítica"],
    ["sensor_failure", "Falha no sensor"],
    ["sensor_recovered", "Sensor recuperado"],
    ["boot", "Dispositivo reiniciado"],
    ["connectivity_restored", "Conexão restabelecida"],
  ])("%s → %s", (type, label) => {
    expect(eventLabel(type)).toBe(label);
  });

  it("tipo sem rótulo aparece com o próprio código", () => {
    expect(eventLabel("tipo_novo")).toBe("tipo_novo");
  });
});
