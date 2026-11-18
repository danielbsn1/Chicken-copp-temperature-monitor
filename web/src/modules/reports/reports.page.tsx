import { Card, EmptyState, PageHeader } from "../../shared/ui";

export function ReportsPage() {
  return (
    <main>
      <PageHeader title="Relatórios" />
      <Card title="Resumo diário">
        <EmptyState message="Sem resumo para este dia." />
      </Card>
    </main>
  );
}
