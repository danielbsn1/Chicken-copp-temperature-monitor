import { useMemo, useState, type ReactNode } from "react";
import { DeviceContext, type DeviceContextValue } from "../../shared/device";
import { ErrorState, Spinner } from "../../shared/ui";
import { useDevices } from "./devices.hooks";

/**
 * Carrega os equipamentos da conta e guarda qual está em uso (só na memória: ao recarregar,
 * volta ao primeiro). Só mostra o conteúdo depois da lista chegar.
 */
export function DeviceProvider({ children }: { children: ReactNode }) {
  const query = useDevices();
  const [selected, setSelected] = useState<string | null>(null);
  const devices = query.data?.devices;

  const value = useMemo<DeviceContextValue | null>(() => {
    if (!devices) return null;
    const active = devices.find((d) => d.id === selected) ?? devices[0];
    return { devices, activeId: active?.id ?? null, select: setSelected };
  }, [devices, selected]);

  if (query.isPending) return <Spinner label="Carregando seus equipamentos…" />;
  if (!value)
    return (
      <ErrorState
        message="Não foi possível carregar seus equipamentos."
        onRetry={() => void query.refetch()}
      />
    );
  return <DeviceContext.Provider value={value}>{children}</DeviceContext.Provider>;
}
