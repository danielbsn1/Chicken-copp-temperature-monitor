import { createContext, useContext } from "react";

export interface ActiveDevice {
  id: string;
  name: string;
}

export interface DeviceContextValue {
  devices: ActiveDevice[];
  /** Equipamento em uso; null quando a conta ainda não tem nenhum. */
  activeId: string | null;
  select: (id: string) => void;
}

/** Quem fornece o valor é o módulo devices; os módulos de dados só leem. */
export const DeviceContext = createContext<DeviceContextValue | null>(null);

export function useDeviceContext(): DeviceContextValue {
  const value = useContext(DeviceContext);
  if (!value) throw new Error("useDeviceContext fora do DeviceProvider");
  return value;
}

/** Equipamento em uso. As telas de dados só aparecem quando existe um. */
export function useActiveDeviceId(): string {
  const { activeId } = useDeviceContext();
  if (!activeId) throw new Error("Nenhum equipamento em uso");
  return activeId;
}
