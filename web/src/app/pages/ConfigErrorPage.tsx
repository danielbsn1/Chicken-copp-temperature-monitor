import { PageHeader } from "../../shared/ui";

/** Tela mostrada quando as variáveis VITE_* faltam ou são inválidas. Lista só os problemas, nunca valores. */
export function ConfigErrorPage({ issues }: { issues: string[] }) {
  return (
    <main role="alert">
      <PageHeader title="Erro de configuração" />
      <p>O painel não foi configurado corretamente:</p>
      <ul>
        {issues.map((issue) => (
          <li key={issue}>{issue}</li>
        ))}
      </ul>
    </main>
  );
}
