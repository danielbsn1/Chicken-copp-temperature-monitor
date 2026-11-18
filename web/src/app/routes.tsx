import { lazy, Suspense, type ReactNode } from "react";
import type { RouteObject } from "react-router";
import { LoginPage, RequireAuth } from "../modules/auth";
import { Spinner } from "../shared/ui";
import { AppLayout } from "./layout/AppLayout";

// Páginas carregadas sob demanda.
const ReportsPage = lazy(() =>
  import("../modules/reports").then((m) => ({ default: m.ReportsPage })),
);
const PainelPage = lazy(() =>
  import("./pages/PainelPage").then((m) => ({ default: m.PainelPage })),
);
const NotFoundPage = lazy(() =>
  import("./pages/NotFoundPage").then((m) => ({ default: m.NotFoundPage })),
);

function Lazy({ children }: { children: ReactNode }) {
  return <Suspense fallback={<Spinner />}>{children}</Suspense>;
}

export const routes: RouteObject[] = [
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            index: true,
            element: (
              <Lazy>
                <PainelPage />
              </Lazy>
            ),
          },
          {
            path: "relatorios",
            element: (
              <Lazy>
                <ReportsPage />
              </Lazy>
            ),
          },
        ],
      },
    ],
  },
  {
    path: "*",
    element: (
      <Lazy>
        <NotFoundPage />
      </Lazy>
    ),
  },
];
