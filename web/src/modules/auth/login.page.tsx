import { EmptyState, PageHeader } from "../../shared/ui";

export function LoginPage() {
  return (
    <main>
      <PageHeader title="Entrar" />
      <EmptyState message="O login ainda não está disponível nesta versão." />
    </main>
  );
}
