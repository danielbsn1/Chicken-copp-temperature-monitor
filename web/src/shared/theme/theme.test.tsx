import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { ThemeToggle } from "./ThemeToggle";
import { initTheme, storedTheme } from "./theme";

afterEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe("tema", () => {
  it("sem escolha guardada, segue o sistema e não força nada no HTML", () => {
    expect(storedTheme()).toBe("system");
    initTheme();
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it("aplica a escolha guardada ao iniciar", () => {
    localStorage.setItem("avitech-theme", "dark");
    initTheme();
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("ignora valor guardado inválido", () => {
    localStorage.setItem("avitech-theme", "roxo");
    expect(storedTheme()).toBe("system");
  });
});

describe("ThemeToggle", () => {
  async function open(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: "Alterar tema" }));
  }

  it("abre o menu com Claro, Escuro e Sistema e começa em Sistema", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    await open(user);
    expect(screen.getAllByRole("menuitemradio").map((o) => o.textContent)).toEqual([
      "Claro",
      "Escuro",
      "Sistema✓",
    ]);
    expect(screen.getByRole("menuitemradio", { name: /Sistema/ })).toBeChecked();
  });

  it("escolher uma opção aplica o tema e guarda só a preferência", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    await open(user);
    await user.click(screen.getByRole("menuitemradio", { name: /Escuro/ }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("avitech-theme")).toBe("dark");

    await open(user);
    await user.click(screen.getByRole("menuitemradio", { name: /Claro/ }));
    expect(document.documentElement.dataset.theme).toBe("light");

    await open(user);
    await user.click(screen.getByRole("menuitemradio", { name: /Sistema/ }));
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(localStorage.getItem("avitech-theme")).toBeNull();
  });
});
