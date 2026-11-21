import { useId, useState } from "react";
import { useSearchParams } from "react-router";
import { formatDateTime } from "../../shared/format/date";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Spinner,
} from "../../shared/ui";
import { eventLabel, isEventType } from "./event-labels";
import styles from "./events.page.module.css";
import { MAX_LIMIT, PAGE_SIZE, useEvents } from "./events.hooks";
import {
  EVENT_PERIODS,
  relativeRange,
  saoPauloToUtc,
  type PeriodId,
} from "./events.period";

interface EventsListProps {
  /** Tipo a mostrar; sem tipo, mostra todos. */
  type?: string;
}

export function EventsList({ type }: EventsListProps) {
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [period, setPeriod] = useState<PeriodId>("all");
  // Instante em que o período relativo foi escolhido (não muda a cada render).
  const [anchor, setAnchor] = useState(() => Date.now());
  const [fromText, setFromText] = useState("");
  const [toText, setToText] = useState("");
  const fromId = useId();
  const toId = useId();

  const from = saoPauloToUtc(fromText);
  const to = saoPauloToUtc(toText);
  const invalidRange = period === "custom" && !!from && !!to && from >= to;
  const range = period === "custom" ? { from, to } : relativeRange(period, anchor);
  const filtered = period !== "all" && (period !== "custom" || !!from || !!to);

  const query = useEvents(type, limit, range, !invalidRange);
  const events = invalidRange ? undefined : query.data?.events;

  return (
    <Card title={type ? eventLabel(type) : "Todos os eventos"}>
      <div role="group" aria-label="Período" className={styles.periods}>
        {EVENT_PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={styles.period}
            aria-pressed={p.id === period}
            onClick={() => {
              setPeriod(p.id);
              setAnchor(Date.now());
              setLimit(PAGE_SIZE);
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
      {period === "custom" ? (
        <div className={styles.dates}>
          <div className={styles.dateField}>
            <label htmlFor={fromId}>De (data e hora)</label>
            <input
              id={fromId}
              type="datetime-local"
              className={styles.input}
              value={fromText}
              onChange={(e) => {
                setFromText(e.target.value);
                setLimit(PAGE_SIZE);
              }}
            />
          </div>
          <div className={styles.dateField}>
            <label htmlFor={toId}>Até (data e hora)</label>
            <input
              id={toId}
              type="datetime-local"
              className={styles.input}
              value={toText}
              onChange={(e) => {
                setToText(e.target.value);
                setLimit(PAGE_SIZE);
              }}
            />
          </div>
          <p className={styles.note}>Horário de São Paulo.</p>
        </div>
      ) : null}
      {invalidRange ? (
        <p role="alert" className={styles.error}>
          A data inicial deve ser anterior à final.
        </p>
      ) : null}

      {query.isPending && !invalidRange ? (
        <Spinner label="Carregando os eventos…" />
      ) : null}
      {query.isError ? (
        <ErrorState
          message="Não foi possível carregar os eventos."
          onRetry={() => void query.refetch()}
        />
      ) : null}
      {events && events.length === 0 ? (
        <EmptyState
          message={
            filtered ? "Nenhum evento neste período." : "Nenhum evento registrado."
          }
        />
      ) : null}
      {events && events.length > 0 ? (
        <>
          <ul className={styles.list}>
            {events.map((e) => (
              <li key={`${e.ts}-${e.type}`} className={styles.item}>
                <time dateTime={e.ts} className={styles.time}>
                  {formatDateTime(e.ts)}
                </time>
                <span>{eventLabel(e.type)}</span>
              </li>
            ))}
          </ul>
          {events.length >= limit && limit < MAX_LIMIT ? (
            <Button
              variant="secondary"
              onClick={() => setLimit((l) => Math.min(l + PAGE_SIZE, MAX_LIMIT))}
              disabled={query.isFetching}
            >
              Ver mais
            </Button>
          ) : null}
          {events.length >= limit && limit >= MAX_LIMIT ? (
            <p className={styles.note}>Mostrando os {MAX_LIMIT} eventos mais recentes.</p>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}

/** Página /eventos: o tipo vem do menu lateral (?tipo=). Tipo desconhecido vira "todos". */
export function EventsPage() {
  const [params] = useSearchParams();
  const raw = params.get("tipo") ?? "";
  const type = isEventType(raw) ? raw : undefined;
  return (
    <main>
      <PageHeader title="Eventos" />
      {/* key: trocar de tipo volta o limite para 50 */}
      <EventsList key={type ?? "todos"} type={type} />
    </main>
  );
}
