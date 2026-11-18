import { Navigate, Outlet, useLocation } from "react-router";
import { ApiError } from "../../shared/api/errors";
import { ErrorState, Spinner } from "../../shared/ui";
import { useSession } from "./auth.hooks";

/** Protege as rotas privadas: sem sessão, redireciona para /login?next=<rota atual>. */
export function RequireAuth() {
  const session = useSession();
  const location = useLocation();

  if (session.isPending) return <Spinner label="Verificando a sessão…" />;

  if (session.isError) {
    if (session.error instanceof ApiError && session.error.status === 401) {
      const next = encodeURIComponent(location.pathname + location.search);
      return <Navigate to={`/login?next=${next}`} replace />;
    }
    return (
      <ErrorState
        message="Não foi possível verificar a sessão."
        onRetry={() => void session.refetch()}
      />
    );
  }

  return <Outlet />;
}
