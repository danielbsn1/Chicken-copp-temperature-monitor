import { Card, EmptyState } from "../../shared/ui";

export function EventsList() {
  return (
    <Card title="Eventos">
      <EmptyState message="Nenhum evento registrado." />
    </Card>
  );
}
