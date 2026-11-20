export type Theme = "system" | "light" | "dark";

const KEY = "avitech-theme";

/** Escolha guardada (só a preferência de tema); sem ela vale "system". */
export function storedTheme(): Theme {
  try {
    const value = localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

function apply(theme: Theme): void {
  if (theme === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}

/** Aplica a escolha guardada; em "system" o CSS segue o tema do sistema operacional. */
export function initTheme(): void {
  apply(storedTheme());
}

export function setTheme(theme: Theme): void {
  apply(theme);
  try {
    if (theme === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, theme);
  } catch {
    // Sem armazenamento (janela privada): a escolha vale só até recarregar.
  }
}
