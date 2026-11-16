const temp = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const pct = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

/** 27.4 → "27,4 °C" */
export function formatTemp(value: number): string {
  return `${temp.format(value)} °C`;
}

/** 62 → "62 %" */
export function formatPct(value: number): string {
  return `${pct.format(value)} %`;
}
