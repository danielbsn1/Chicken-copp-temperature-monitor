import { formatDateTime } from "../../shared/format/date";
import { formatPct, formatTemp } from "../../shared/format/number";
import { Card, ErrorState, Spinner, StatusBadge } from "../../shared/ui";
import styles from "./status.page.module.css";
import { useStatus } from "./status.hooks";
import type { DeviceStatus } from "./status.schemas";
import { statusVerdict } from "./status-tone";

const NONE = "—";

export function StatusCard() {
  const query = useStatus();

  return (
    <Card title="Situação atual">
      {query.isPending ? <Spinner label="Carregando o status…" /> : null}
      {query.isError ? (
        <ErrorState
          message="Não foi possível carregar o status."
          onRetry={() => void query.refetch()}
        />
      ) : null}
      {query.data ? <StatusBody status={query.data} now={query.dataUpdatedAt} /> : null}
    </Card>
  );
}

function StatusBody({ status, now }: { status: DeviceStatus; now: number }) {
  const verdict = statusVerdict(status, now);
  const { reading } = status;
  return (
    <>
      <p className={styles.badge}>
        <StatusBadge tone={verdict.tone} label={verdict.label} />
      </p>
      <dl className={styles.list}>
        <div>
          <dt>Temperatura</dt>
          <dd className={styles.big}>{reading ? formatTemp(reading.tempC) : NONE}</dd>
        </div>
        <div>
          <dt>Umidade</dt>
          <dd className={styles.big}>{reading ? formatPct(reading.humPct) : NONE}</dd>
        </div>
        <div>
          <dt>Ventilador</dt>
          <dd>{status.fanOn === null ? NONE : status.fanOn ? "Ligado" : "Desligado"}</dd>
        </div>
        <div>
          <dt>Última comunicação</dt>
          <dd>{status.lastSeenAt ? formatDateTime(status.lastSeenAt) : "Nunca"}</dd>
        </div>
        <div>
          <dt>Versão do firmware</dt>
          <dd>{status.fwVersion ?? NONE}</dd>
        </div>
      </dl>
    </>
  );
}
