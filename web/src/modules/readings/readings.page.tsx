import { useState } from "react";
import { formatDateTime, formatDayMonth, formatTime } from "../../shared/format/date";
import { formatTemp } from "../../shared/format/number";
import { Card, ErrorState, Spinner } from "../../shared/ui";
import { TemperatureChart, type TemperaturePoint } from "./components/TemperatureChart";
import { DEFAULT_PERIOD, PERIODS, periodById, type PeriodId } from "./readings.periods";
import styles from "./readings.page.module.css";
import { useReadings } from "./readings.hooks";
import type { Series } from "./readings.schemas";

function toPoints(series: Series, period: PeriodId): TemperaturePoint[] {
  const longPeriod = period === "7d" || period === "30d";
  return series.points.map((p) => ({
    time: longPeriod ? formatDayMonth(p.ts) : formatTime(p.ts),
    when: formatDateTime(p.ts),
    min: p.minC,
    avg: p.avgC,
    max: p.maxC,
  }));
}

export function ReadingsChart() {
  const [period, setPeriod] = useState<PeriodId>(DEFAULT_PERIOD);
  const query = useReadings(period);

  return (
    <Card title="Temperatura">
      <div role="group" aria-label="Período" className={styles.periods}>
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={styles.period}
            aria-pressed={p.id === period}
            onClick={() => setPeriod(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <p className={styles.hint}>
        Últimos {periodById(period).label}, em intervalos de {periodById(period).bucket}.
      </p>
      {query.isPending ? <Spinner label="Carregando as leituras…" /> : null}
      {query.isError ? (
        <ErrorState
          message="Não foi possível carregar as leituras."
          onRetry={() => void query.refetch()}
        />
      ) : null}
      {query.data && query.data.points.length > 0 ? (
        <Summary series={query.data} />
      ) : null}
      {query.data ? <TemperatureChart points={toPoints(query.data, period)} /> : null}
    </Card>
  );
}

/** Mínima, média e máxima do período, para ler sem passar o mouse no gráfico. */
function Summary({ series }: { series: Series }) {
  const { points } = series;
  const min = Math.min(...points.map((p) => p.minC));
  const max = Math.max(...points.map((p) => p.maxC));
  const avg = points.reduce((sum, p) => sum + p.avgC, 0) / points.length;
  return (
    <dl className={styles.summary}>
      <div>
        <dt>Mínima no período</dt>
        <dd>{formatTemp(min)}</dd>
      </div>
      <div>
        <dt>Média no período</dt>
        <dd>{formatTemp(avg)}</dd>
      </div>
      <div>
        <dt>Máxima no período</dt>
        <dd>{formatTemp(max)}</dd>
      </div>
    </dl>
  );
}
