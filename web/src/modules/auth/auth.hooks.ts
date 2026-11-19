import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router";
import { ApiError } from "../../shared/api/errors";
import { getSession, postLogin, postLogout } from "./auth.api";

export const sessionKey = ["session"] as const;

/** Sessão atual: 200 libera as rotas privadas, 401 leva ao login. */
export function useSession() {
  return useQuery({
    queryKey: sessionKey,
    queryFn: ({ signal }) => getSession(signal),
  });
}

/** Encerra a sessão, limpa o cache e vai para o login. */
export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: postLogout,
    onSettled: () => {
      queryClient.clear();
      void navigate("/login");
    },
  });
}

/** Só aceita caminho interno do próprio painel; o resto (URL externa, //x, /login) vira "/". */
export function safeNext(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  if (next === "/login" || next.startsWith("/login?")) return "/";
  return next;
}

/** Mensagem para o produtor conforme a falha do login. */
export function loginErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "E-mail ou senha inválidos";
    if (error.status === 429) return "Muitas tentativas. Tente de novo em 15 minutos.";
    if (error.code === "NETWORK_ERROR" || error.code === "TIMEOUT")
      return "Sem conexão com o servidor";
  }
  return "Não foi possível entrar. Tente de novo.";
}

/** Entra com e-mail e senha; o cookie httpOnly vem da API e nada é guardado no navegador. */
export function useLogin() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  return useMutation({
    mutationFn: postLogin,
    onSuccess: (session) => {
      queryClient.setQueryData(sessionKey, session);
      void navigate(safeNext(params.get("next")), { replace: true });
    },
  });
}
