import { Link, useNavigate } from "react-router";
import logoClaro from "../../shared/assets/logo-avitech-texto-claro.png";
import logo from "../../shared/assets/logo-avitech-texto.png";
import { ThemeToggle } from "../../shared/theme";
import { useStartSession } from "../../modules/auth";
import { PairForm, useSignup, type SignupInput } from "../../modules/devices";
import styles from "./SignupPage.module.css";

/** Primeiro acesso: acha o equipamento na rede, cria a conta e entra. */
export function SignupPage() {
  const signup = useSignup(useStartSession());
  const navigate = useNavigate();

  return (
    <div className={styles.layout}>
      <div className={styles.theme}>
        <ThemeToggle />
      </div>
      <main className={styles.card}>
        <img className={styles.logoClaro} src={logo} alt="Avitech" width={180} />
        <img className={styles.logoEscuro} src={logoClaro} alt="Avitech" width={180} />
        <h1 className={styles.title}>Primeiro acesso</h1>
        <p className={styles.subtitle}>
          Encontre seu equipamento e crie sua conta para monitorar o galinheiro.
        </p>
        <PairForm
          signup
          pending={signup.isPending}
          error={signup.error}
          onSubmit={(input) =>
            signup.mutate(input as SignupInput, {
              onSuccess: () => void navigate("/", { replace: true }),
            })
          }
        />
        <p className={styles.back}>
          Já tem conta? <Link to="/login">Entrar</Link>
        </p>
      </main>
    </div>
  );
}
