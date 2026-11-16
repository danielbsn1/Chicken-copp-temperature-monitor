import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../shared/test/render";
import { StatusCard } from "./index";

describe("StatusCard", () => {
  it("mostra o título e o estado vazio", () => {
    renderWithProviders(<StatusCard />);
    expect(screen.getByRole("heading", { name: "Situação atual" })).toBeInTheDocument();
    expect(screen.getByText(/\S/, { selector: "p" })).toBeInTheDocument();
  });
});
