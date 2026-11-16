import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { setUnauthorizedHandler } from "../shared/api/http";
import { queryClient } from "./query-client";
import { routes } from "./routes";

export function App() {
  const [router] = useState(() => createBrowserRouter(routes));

  // Qualquer 401 depois do início limpa o cache e leva ao login, guardando a rota atual.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      const { pathname, search } = router.state.location;
      if (pathname === "/login") return;
      queryClient.clear();
      void router.navigate(`/login?next=${encodeURIComponent(pathname + search)}`);
    });
    return () => setUnauthorizedHandler(undefined);
  }, [router]);

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
