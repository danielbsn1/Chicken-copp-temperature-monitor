import styles from "./Spinner.module.css";

export function Spinner({ label = "Carregando…" }: { label?: string }) {
  return (
    <div role="status" className={styles.spinner}>
      <span className={styles.dot} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
