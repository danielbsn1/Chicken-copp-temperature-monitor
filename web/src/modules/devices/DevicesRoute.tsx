import { Navigate, Outlet, useLocation } from "react-router";
import { useDeviceContext } from "../../shared/device";
import { DeviceProvider } from "./device-context";

export const PAIR_PATH = "/equipamentos/novo";

function Gate() {
  const { devices } = useDeviceContext();
  const { pathname } = useLocation();
  // Conta sem equipamento: só a tela de vincular faz sentido.
  if (devices.length === 0 && pathname !== PAIR_PATH) {
    return <Navigate to={PAIR_PATH} replace />;
  }
  return <Outlet />;
}

/** Rota de layout: carrega os equipamentos e leva a conta vazia para o pareamento. */
export function DevicesRoute() {
  return (
    <DeviceProvider>
      <Gate />
    </DeviceProvider>
  );
}
