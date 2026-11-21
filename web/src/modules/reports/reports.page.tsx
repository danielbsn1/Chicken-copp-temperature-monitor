import { useId, useState } from "react";
import { useActiveDeviceId } from "../../shared/device";
import { ApiError } from "../../shared/api/errors";
import { formatDay, yesterdayInSaoPaulo } from "../../shared/format/date";
import { formatTemp } from "../../shared/format/number";
import { Card, EmptyState, ErrorState, PageHeader, Spinner } from "../../shared/ui";
import styles from "./reports.page.module.css";
import { dailyCsvUrl } from "./reports.api";
import { useDailyReport } from "./reports.hooks";
import type { DailySummary } from "./reports.schemas";

export function ReportsPage() {
  // Ontem, no fuso de São Paulo: o dia mais recente que já tem resumo.
  const [yesterday] = useState(() => yesterdayInSaoPaulo());
  const [day, setDay] = useState(yesterday);
  const dayId = useId();
  const query = useDailyReport(day);
  const notFound = query.error instanceof ApiError && query.error.status === 404;

  return (
    <main>
      <PageHeader title="Relatórios" />
      <Card title="Resumo diário">
        <div className={styles.picker}>
          <label htmlFor={dayId}>Dia</label>
          <input
            id={dayId}
            type="date"
            className={styles.input}
            value={day}
            max={yesterday}
            onChange={(e) => setDay(e.target.value)}
          />
        </div>

        {day === "" ? <EmptyState message="Escolha um dia." /> : null}
        {day !== "" && query.isPending ? <Spinner label="Carregando o resumo…" /> : null}
        {notFound ? <EmptyState message="Sem resumo para este dia." /> : null}
        {query.isError && !notFound ? (
          <ErrorState
            message="Não foi possível carregar o resumo."
            onRetry={() => void query.refetch()}
          />
        ) : null}
        {day !== "" && query.data && !query.isError ? (
          <Summary summary={query.data} />
        ) : null}
      </Card>
    </main>
  );
}

function Summary({ summary }: { summary: DailySummary }) {
  const deviceId = useActiveDeviceId();
  return (
    <>
      <h3 className={styles.heading}>Resumo de {formatDay(summary.day)}</h3>
      <dl className={styles.list}>
        <div>
          <dt>Temperatura mínima</dt>
          <dd className={styles.big}>{formatTemp(summary.tempMinC)}</dd>
        </div>
        <div>
          <dt>Temperatura máxima</dt>
          <dd className={styles.big}>{formatTemp(summary.tempMaxC)}</dd>
        </div>
        <div>
          <dt>Temperatura média</dt>
          <dd className={styles.big}>{formatTemp(summary.tempAvgC)}</dd>
        </div>
        <div>
          <dt>Ventilador ligado</dt>
          <dd className={styles.big}>{summary.fanOnMinutes} min</dd>
        </div>
        <div>
          <dt>Leituras</dt>
          <dd className={styles.big}>{summary.readingsCount}</dd>
        </div>
      </dl>
      <a className={styles.download} href={dailyCsvUrl(deviceId, summary.day)} download>
        Baixar CSV
      </a>
    </>
  );
}
