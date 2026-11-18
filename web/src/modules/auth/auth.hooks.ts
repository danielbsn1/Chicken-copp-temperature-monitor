import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { getSession, postLogout } from "./auth.api";

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
