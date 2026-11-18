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
