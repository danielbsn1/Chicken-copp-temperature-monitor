import { EventsList } from "../../modules/events";
import { ReadingsChart } from "../../modules/readings";
import { StatusCard } from "../../modules/status";
import { PageHeader } from "../../shared/ui";
import styles from "./PainelPage.module.css";

/** Reúne os blocos de três módulos: status, gráfico e eventos. */
export function PainelPage() {
  return (
    <main>
      <PageHeader title="Painel" />
      <p className={styles.notice} role="note">
        <span aria-hidden="true">ⓘ</span> Os dados chegam em lotes de 15 min.
      </p>
      <div className={styles.grid}>
        <StatusCard />
        <ReadingsChart />
        <EventsList />
      </div>
    </main>
  );
}
