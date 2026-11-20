import * as Menu from "@radix-ui/react-dropdown-menu";
import { useState } from "react";
import { setTheme, storedTheme, type Theme } from "./theme";
import styles from "./ThemeToggle.module.css";

const svg = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

const OPTIONS: { value: Theme; label: string }[] = [
  { value: "light", label: "Claro" },
  { value: "dark", label: "Escuro" },
  { value: "system", label: "Sistema" },
];

/**
 * Menu de tema: o botão mostra um sol no tema claro e uma lua no escuro (o CSS
 * escolhe pelo tema em uso, inclusive quando vem do sistema); o menu oferece
 * Claro, Escuro e Sistema, com a opção atual marcada por texto e ✓.
 */
export function ThemeToggle() {
  const [theme, setCurrent] = useState<Theme>(storedTheme);

  return (
    <Menu.Root>
      <Menu.Trigger className={styles.trigger} aria-label="Alterar tema">
        <svg {...svg} className={styles.sun}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
        <svg {...svg} className={styles.moon}>
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content className={styles.content} align="start" sideOffset={6}>
          <Menu.RadioGroup
            value={theme}
            onValueChange={(value) => {
              const next = value as Theme;
              setTheme(next);
              setCurrent(next);
            }}
          >
            {OPTIONS.map(({ value, label }) => (
              <Menu.RadioItem key={value} value={value} className={styles.item}>
                {label}
                <Menu.ItemIndicator className={styles.check} aria-hidden="true">
                  ✓
                </Menu.ItemIndicator>
              </Menu.RadioItem>
            ))}
          </Menu.RadioGroup>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
