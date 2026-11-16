import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../shared/test/render";
import { ReadingsChart } from "./index";

describe("ReadingsChart", () => {
  it("mostra o título e o estado vazio", () => {
    renderWithProviders(<ReadingsChart />);
    expect(screen.getByRole("heading", { name: "Temperatura" })).toBeInTheDocument();
    expect(screen.getByText(/\S/, { selector: "p" })).toBeInTheDocument();
  });
});
