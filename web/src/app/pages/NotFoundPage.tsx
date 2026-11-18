import { Link } from "react-router";
import { EmptyState, PageHeader } from "../../shared/ui";

export function NotFoundPage() {
  return (
    <main>
      <PageHeader title="Página não encontrada" />
      <EmptyState message="O endereço não existe." />
      <p>
        <Link to="/">Voltar ao painel</Link>
      </p>
    </main>
  );
}
