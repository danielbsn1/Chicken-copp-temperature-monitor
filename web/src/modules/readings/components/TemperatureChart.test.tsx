import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TemperatureChart } from "./TemperatureChart";

describe("TemperatureChart", () => {
  it("sem pontos mostra o estado vazio", () => {
    render(<TemperatureChart points={[]} />);
    expect(screen.getByText("Sem leituras no período.")).toBeInTheDocument();
  });

  it("com pontos descreve mínima, média e máxima no aria-label", () => {
    render(
      <TemperatureChart
        points={[
          { time: "10:00", min: 26, avg: 27, max: 28.5 },
          { time: "10:05", min: 27, avg: 29, max: 31 },
        ]}
      />,
    );
    expect(screen.getByRole("img")).toHaveAccessibleName(
      "Temperatura no período: mínima 26,0 °C, média 28,0 °C, máxima 31,0 °C",
    );
  });
});
