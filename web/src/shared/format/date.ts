const TIME_ZONE = "America/Sao_Paulo";

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIME_ZONE,
  dateStyle: "short",
  timeStyle: "short",
});
const time = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIME_ZONE,
  timeStyle: "short",
});
// "en-CA" formata como AAAA-MM-DD.
const day = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

type DateInput = string | Date;

/** Converte o ISO 8601 UTC da API em data e hora de São Paulo (única conversão do painel). */
export function formatDateTime(value: DateInput): string {
  return dateTime.format(new Date(value));
}

export function formatTime(value: DateInput): string {
  return time.format(new Date(value));
}

/** Dia (AAAA-MM-DD) no fuso America/Sao_Paulo. */
export function toSaoPauloDay(value: DateInput): string {
  return day.format(new Date(value));
}

const dayMonth = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
});

/** "14/11" no fuso de São Paulo, para o eixo de períodos longos. */
export function formatDayMonth(value: DateInput): string {
  return dayMonth.format(new Date(value));
}

/** Ontem (AAAA-MM-DD) no fuso America/Sao_Paulo. */
export function yesterdayInSaoPaulo(now: DateInput = new Date()): string {
  const today = toSaoPauloDay(now);
  return new Date(Date.parse(`${today}T00:00:00Z`) - 86_400_000)
    .toISOString()
    .slice(0, 10);
}

/** "2026-11-14" → "14/11/2026". O dia já é civil: não passa por conversão de fuso. */
export function formatDay(day: string): string {
  const [year, month, date] = day.split("-");
  return `${date}/${month}/${year}`;
}
