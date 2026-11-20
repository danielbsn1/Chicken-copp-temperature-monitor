import { useState, type FormEvent } from "react";
import logoClaro from "../../shared/assets/logo-avitech-texto-claro.png";
import logo from "../../shared/assets/logo-avitech-texto.png";
import { ThemeToggle } from "../../shared/theme";
import { Button, Field } from "../../shared/ui";
import { loginErrorMessage, useLogin } from "./auth.hooks";
import styles from "./login.page.module.css";

export function LoginPage() {
  const login = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  function submit(event: FormEvent) {
    event.preventDefault();
    login.mutate({ email, password });
  }

  return (
    <div className={styles.layout}>
      <div className={styles.theme}>
        <ThemeToggle />
      </div>
      <main className={styles.main}>
        <div className={styles.card}>
          <img className={styles.logoClaro} src={logo} alt="Avitech" width={200} />
          <img className={styles.logoEscuro} src={logoClaro} alt="Avitech" width={200} />
          <h1 className={styles.title}>Entrar</h1>
          <p className={styles.subtitle}>Insira suas credenciais abaixo para entrar</p>
          <form className={styles.form} onSubmit={submit} noValidate>
            <Field
              label="E-mail"
              type="email"
              name="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Field
              label="Senha"
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              trailing={
                <button
                  type="button"
                  className={styles.toggle}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? "Ocultar" : "Mostrar"}
                </button>
              }
            />
            {login.isError ? (
              <p role="alert" className={styles.error}>
                {loginErrorMessage(login.error)}
              </p>
            ) : null}
            <Button type="submit" disabled={login.isPending || !email || !password}>
              {login.isPending ? "Entrando…" : "Entrar"}
            </Button>
          </form>
        </div>
      </main>
      <div className={styles.art} aria-hidden="true">
        <svg viewBox="0 0 960 1000" preserveAspectRatio="none">
          <path
            className={styles.waveLight}
            d="M960 480 C 860 620 720 640 560 610 C 330 570 120 720 0 850 L0 1000 L960 1000 Z"
          />
          <path
            className={styles.waveWhite}
            d="M960 830 C 880 940 780 940 690 890 C 560 800 360 760 180 860 C 110 900 50 950 0 1000 L960 1000 Z"
          />
        </svg>
      </div>
    </div>
  );
}
