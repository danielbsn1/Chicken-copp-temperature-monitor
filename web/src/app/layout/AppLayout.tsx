import { NavLink, Outlet } from "react-router";
import { useLogout } from "../../modules/auth";
import { Button } from "../../shared/ui";
import styles from "./AppLayout.module.css";

export function AppLayout() {
  const logout = useLogout();
  return (
    <>
      <a className={styles.skip} href="#conteudo">
        Pular para o conteúdo
      </a>
      <header className={styles.header}>
        <span className={styles.brand}>Avitech</span>
        <nav className={styles.nav} aria-label="Principal">
          <NavLink className={styles.link} to="/" end>
            Painel
          </NavLink>
          <NavLink className={styles.link} to="/relatorios">
            Relatórios
          </NavLink>
        </nav>
        <Button
          variant="secondary"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
        >
          Sair
        </Button>
      </header>
      <div id="conteudo" className={styles.content} tabIndex={-1}>
        <Outlet />
      </div>
    </>
  );
}
