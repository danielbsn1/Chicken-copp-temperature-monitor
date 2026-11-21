import * as Collapsible from "@radix-ui/react-collapsible";
import { useState } from "react";
import { Link, NavLink, Outlet, useLocation, useSearchParams } from "react-router";
import { useLogout } from "../../modules/auth";
import { DeviceSelect } from "../../modules/devices";
import { EVENT_TYPES, eventLabel } from "../../modules/events";
import { ThemeToggle } from "../../shared/theme";
import { Button } from "../../shared/ui";
import styles from "./AppLayout.module.css";

/** Item de /eventos, ativo só quando o ?tipo= bate (vazio = todos). */
function EventLink({
  type,
  label,
  onNavigate,
}: {
  type: string;
  label: string;
  onNavigate: () => void;
}) {
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const active = pathname === "/eventos" && (params.get("tipo") ?? "") === type;
  return (
    <Link
      className={`${styles.sublink} ${active ? styles.active : ""}`}
      to={type ? `/eventos?tipo=${type}` : "/eventos"}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
    >
      {label}
    </Link>
  );
}

export function AppLayout() {
  const logout = useLogout();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);
  const [eventsOpen, setEventsOpen] = useState(pathname === "/eventos");

  return (
    <div className={styles.shell}>
      <a className={styles.skip} href="#conteudo">
        Pular para o conteúdo
      </a>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.menuButton}
          aria-expanded={menuOpen}
          aria-controls="menu-lateral"
          onClick={() => setMenuOpen((o) => !o)}
        >
          Menu
        </button>
        <span className={styles.brand}>Avitech</span>
        <span className={styles.spacer} />
        <DeviceSelect />
        <ThemeToggle />
        <Button
          variant="secondary"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
        >
          Sair
        </Button>
      </header>
      <aside
        id="menu-lateral"
        className={`${styles.sidebar} ${menuOpen ? styles.sidebarOpen : ""}`}
      >
        <nav aria-label="Principal">
          <ul className={styles.list}>
            <li>
              <NavLink className={styles.link} to="/" end onClick={closeMenu}>
                Situação atual
              </NavLink>
            </li>
            <li>
              <Collapsible.Root open={eventsOpen} onOpenChange={setEventsOpen}>
                <Collapsible.Trigger className={styles.trigger}>
                  <span>Eventos</span>
                  <span aria-hidden="true" className={styles.chevron}>
                    {eventsOpen ? "▾" : "▸"}
                  </span>
                </Collapsible.Trigger>
                <Collapsible.Content>
                  <ul className={styles.sublist}>
                    <li>
                      <EventLink
                        type=""
                        label="Todos os eventos"
                        onNavigate={closeMenu}
                      />
                    </li>
                    {EVENT_TYPES.map((t) => (
                      <li key={t}>
                        <EventLink
                          type={t}
                          label={eventLabel(t)}
                          onNavigate={closeMenu}
                        />
                      </li>
                    ))}
                  </ul>
                </Collapsible.Content>
              </Collapsible.Root>
            </li>
            <li>
              <NavLink className={styles.link} to="/relatorios" onClick={closeMenu}>
                Relatórios
              </NavLink>
            </li>
            <li>
              <NavLink
                className={styles.link}
                to="/equipamentos/novo"
                onClick={closeMenu}
              >
                Adicionar equipamento
              </NavLink>
            </li>
          </ul>
        </nav>
      </aside>
      <div id="conteudo" className={styles.content} tabIndex={-1}>
        <Outlet />
      </div>
    </div>
  );
}
