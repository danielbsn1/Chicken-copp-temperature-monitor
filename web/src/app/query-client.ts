import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "../shared/api/errors";

/** Sem nova tentativa em erro 4xx; em 5xx e falha de rede, até 2 tentativas. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500)
    return false;
  return failureCount < 2;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: shouldRetry,
        refetchIntervalInBackground: false,
      },
    },
  });
}

export const queryClient = createQueryClient();
