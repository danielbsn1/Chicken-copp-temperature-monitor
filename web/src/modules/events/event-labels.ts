const LABELS: Record<string, string> = {
  fan_on: "Ventilador ligado",
  fan_off: "Ventilador desligado",
  temp_critical: "Temperatura crítica",
  sensor_failure: "Falha no sensor",
  sensor_recovered: "Sensor recuperado",
  boot: "Dispositivo reiniciado",
  connectivity_restored: "Conexão restabelecida",
};

/** Rótulo em português do tipo de evento; um tipo sem rótulo aparece com o próprio código. */
export function eventLabel(type: string): string {
  return LABELS[type] ?? type;
}

/** Os 7 tipos que o dispositivo envia, na ordem do filtro. */
export const EVENT_TYPES = Object.keys(LABELS);
