import { env } from "../../config/env.js";

/** Resumo de um dia, como o módulo reports o entrega. */
export interface DailyMessage {
  deviceName: string;
  day: string;
  tempMinC: number;
  tempMaxC: number;
  tempAvgC: number;
  fanOnMinutes: number;
  readingsCount: number;
}

/** Falha ao falar com o Telegram. A mensagem nunca leva o token nem a URL. */
export class TelegramError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TelegramError";
  }
}

const temp = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function brDate(day: string): string {
  const [year, month, date] = day.split("-");
  return `${date}/${month}/${year}`;
}

/** Texto simples (sem formatação do Telegram) do resumo diário, em português. */
export function formatDailySummary(m: DailyMessage): string {
  return [
    `Resumo de ${brDate(m.day)} — ${m.deviceName}`,
    `Temperatura: mínima ${temp.format(m.tempMinC)} °C, média ${temp.format(m.tempAvgC)} °C, máxima ${temp.format(m.tempMaxC)} °C`,
    `Ventilador: ${m.fanOnMinutes} min ligado`,
    `Leituras: ${m.readingsCount}`,
  ].join("\n");
}

const TIMEOUT_MS = 8000;

/** Envia o texto à conversa configurada. Lança TelegramError se o Telegram não aceitar. */
export async function sendTelegram(text: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );
  } catch {
    // Não repassa o erro original: ele pode conter a URL com o token.
    throw new TelegramError("Telegram indisponível (sem resposta)");
  }
  if (!response.ok)
    throw new TelegramError(`Telegram recusou a mensagem (HTTP ${response.status})`);
}
