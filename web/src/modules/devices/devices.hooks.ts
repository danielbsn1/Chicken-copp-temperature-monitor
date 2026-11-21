import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../../shared/api/errors";
import { getAvailable, getDevices, postClaim, postSignup } from "./devices.api";
import type { ClaimInput, SignupInput } from "./devices.schemas";

export const devicesKey = ["devices"] as const;

export function useDevices() {
  return useQuery({ queryKey: devicesKey, queryFn: ({ signal }) => getDevices(signal) });
}

/** Procura equipamentos esperando dono; confere de novo a cada 3 s (para com a aba oculta). */
export function useAvailableDevices() {
  return useQuery({
    queryKey: ["pairing", "available"],
    queryFn: ({ signal }) => getAvailable(signal),
    refetchInterval: 3_000,
    gcTime: 0,
  });
}

/** Vincula o equipamento à conta logada e atualiza a lista de equipamentos. */
export function useClaim() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ClaimInput) => postClaim(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: devicesKey }),
  });
}

/**
 * Cria a conta com o primeiro equipamento e já entra (a API não abre sessão no cadastro).
 * `startSession` vem de quem monta a tela (o módulo auth), porque módulos não se importam.
 */
export function useSignup(
  startSession: (credentials: { email: string; password: string }) => Promise<unknown>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SignupInput) => {
      const claimed = await postSignup(input);
      await startSession({ email: input.email, password: input.password });
      await queryClient.invalidateQueries({ queryKey: devicesKey });
      return claimed;
    },
  });
}

/** Mensagem para o produtor conforme a falha do pareamento. */
export function pairingErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "PAIRING_CLOSED")
      return "Aperte o botão de pareamento do equipamento e tente de novo.";
    if (error.status === 404)
      return "Equipamento não encontrado. Confira o serial e se ele está ligado e conectado.";
    if (error.status === 409) return "Este e-mail já tem conta. Entre com ele.";
    if (error.status === 400)
      return "Confira os dados: a senha precisa de 12 caracteres.";
    if (error.status === 429) return "Muitas tentativas. Tente de novo mais tarde.";
    if (error.code === "NETWORK_ERROR" || error.code === "TIMEOUT")
      return "Sem conexão com o servidor";
  }
  return "Não foi possível vincular. Tente de novo.";
}
