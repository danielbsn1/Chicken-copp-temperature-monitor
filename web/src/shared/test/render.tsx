import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router";
import { DeviceContext } from "../device";

interface Options {
  /** Rota inicial, por exemplo "/login?next=/". */
  route?: string;
}

/** Renderiza com os provedores do app: TanStack Query (sem novas tentativas) e Router. */
export function renderWithProviders(ui: ReactElement, { route = "/" }: Options = {}) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <DeviceContext.Provider
          value={{
            devices: [{ id: "galinheiro-teste", name: "Galinheiro teste" }],
            activeId: "galinheiro-teste",
            select: () => undefined,
          }}
        >
          <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
        </DeviceContext.Provider>
      </QueryClientProvider>,
    ),
  };
}
