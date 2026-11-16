import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../shared/test/render";
import { EventsList } from "./index";

describe("EventsList", () => {
  it("mostra o título e o estado vazio", () => {
    renderWithProviders(<EventsList />);
    expect(screen.getByRole("heading", { name: "Eventos" })).toBeInTheDocument();
    expect(screen.getByText(/\S/, { selector: "p" })).toBeInTheDocument();
  });
});
