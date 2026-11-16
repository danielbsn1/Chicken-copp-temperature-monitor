import { Card, EmptyState } from "../../shared/ui";

export function StatusCard() {
  return (
    <Card title="Situação atual">
      <EmptyState message="Sem dados do dispositivo ainda." />
    </Card>
  );
}
