import { describe, expect, it } from "vitest";
import { statusVerdict } from "./status-tone";
import type { DeviceStatus } from "./status.schemas";

const NOW = Date.parse("2026-11-14T15:00:00Z");
const minutesAgo = (m: number) => new Date(NOW - m * 60_000).toISOString();

function status(tempC: number | null, lastSeenMinutes: number | null): DeviceStatus {
  return {
    reading:
      tempC === null ? null : { ts: minutesAgo(1), tempC, humPct: 60, fanOn: false },
    fanOn: null,
    lastSeenAt: lastSeenMinutes === null ? null : minutesAgo(lastSeenMinutes),
    fwVersion: "2.0.1",
  };
}

describe("statusVerdict", () => {
  it.each([
    [27.4, "normal", "Normal"],
    [29.9, "normal", "Normal"],
    [30, "attention", "Atenção"],
    [34.9, "attention", "Atenção"],
    [35, "critical", "Crítico"],
    [41, "critical", "Crítico"],
  ])("%s °C com comunicação recente -> %s", (temp, tone, label) => {
    expect(statusVerdict(status(temp, 5), NOW)).toEqual({ tone, label });
  });

  it("30 min exatos ainda é comunicação; acima disso é sem comunicação", () => {
    expect(statusVerdict(status(27, 30), NOW).label).toBe("Normal");
    expect(statusVerdict(status(27, 31), NOW)).toEqual({
      tone: "offline",
      label: "Sem comunicação",
    });
  });

  it("sem comunicação vale mais que temperatura crítica", () => {
    expect(statusVerdict(status(40, 60), NOW).label).toBe("Sem comunicação");
  });

  it("nunca se comunicou ou sem leitura é sem comunicação", () => {
    expect(statusVerdict(status(null, null), NOW).label).toBe("Sem comunicação");
    expect(statusVerdict(status(null, 5), NOW).label).toBe("Sem comunicação");
  });
});
