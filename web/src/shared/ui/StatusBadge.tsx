import styles from "./StatusBadge.module.css";

export type StatusTone = "normal" | "attention" | "critical" | "offline";

const MARKS: Record<StatusTone, string> = {
  normal: "●",
  attention: "▲",
  critical: "■",
  offline: "○",
};

interface StatusBadgeProps {
  tone: StatusTone;
  /** O texto sempre aparece: o estado nunca depende só da cor. */
  label: string;
}

export function StatusBadge({ tone, label }: StatusBadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[tone]}`}>
      <span aria-hidden="true">{MARKS[tone]}</span>
      {label}
    </span>
  );
}
