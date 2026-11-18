import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../shared/test/render";
import { ReportsPage } from "./index";

describe("ReportsPage", () => {
  it("mostra o título e o estado vazio", () => {
    renderWithProviders(<ReportsPage />);
    expect(screen.getByRole("heading", { name: "Relatórios" })).toBeInTheDocument();
    expect(screen.getByText(/\S/, { selector: "p" })).toBeInTheDocument();
  });
});
