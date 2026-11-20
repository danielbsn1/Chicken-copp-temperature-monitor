import { useId, useState } from "react";
import { formatDateTime } from "../../shared/format/date";
import { Button, Card, EmptyState, ErrorState, Spinner } from "../../shared/ui";
import { EVENT_TYPES, eventLabel } from "./event-labels";
import styles from "./events.page.module.css";
import { MAX_LIMIT, PAGE_SIZE, useEvents } from "./events.hooks";

export function EventsList() {
  const [type, setType] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const selectId = useId();
  const query = useEvents(type || undefined, limit);
  const events = query.data?.events;

  return (
    <Card title="Eventos">
      <div className={styles.filter}>
        <label htmlFor={selectId}>Tipo de evento</label>
        <select
          id={selectId}
          className={styles.select}
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setLimit(PAGE_SIZE);
          }}
        >
          <option value="">Todos</option>
          {EVENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {eventLabel(t)}
            </option>
          ))}
        </select>
      </div>

      {query.isPending ? <Spinner label="Carregando os eventos…" /> : null}
      {query.isError ? (
        <ErrorState
          message="Não foi possível carregar os eventos."
          onRetry={() => void query.refetch()}
        />
      ) : null}
      {events && events.length === 0 ? (
        <EmptyState message="Nenhum evento registrado." />
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
