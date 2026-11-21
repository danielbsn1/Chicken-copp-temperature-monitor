import { lazy, Suspense, type ReactNode } from "react";
import type { RouteObject } from "react-router";
import { LoginPage, RequireAuth } from "../modules/auth";
import { DevicesRoute, PAIR_PATH, PairPage } from "../modules/devices";
import { Spinner } from "../shared/ui";
import { AppLayout } from "./layout/AppLayout";
import { SignupPage } from "./pages/SignupPage";

// Páginas carregadas sob demanda.
const ReportsPage = lazy(() =>
  import("../modules/reports").then((m) => ({ default: m.ReportsPage })),
);
const EventsPage = lazy(() =>
  import("../modules/events").then((m) => ({ default: m.EventsPage })),
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
    path: "/cadastro",
    element: <SignupPage />,
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <DevicesRoute />,
        children: [
          {
            element: <AppLayout />,
            children: [
              {
                path: PAIR_PATH.slice(1),
                element: <PairPage />,
              },
              {
                index: true,
                element: (
                  <Lazy>
                    <PainelPage />
                  </Lazy>
                ),
              },
              {
                path: "eventos",
                element: (
                  <Lazy>
                    <EventsPage />
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
