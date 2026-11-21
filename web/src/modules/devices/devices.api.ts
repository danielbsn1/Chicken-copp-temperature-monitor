import { env } from "../../config/env";
import { http } from "../../shared/api/http";
import {
  availableSchema,
  type AvailableDevice,
  claimedSchema,
  devicesSchema,
  type ClaimInput,
  type SignupInput,
} from "./devices.schemas";

export function getDevices(signal?: AbortSignal) {
  return http("/devices", { signal }, devicesSchema);
}

/**
 * Equipamentos com o botão de pareamento apertado, vistos do mesmo IP de quem pergunta.
 * O aparelho costuma sair por IPv4 e o navegador por IPv6 (ou o contrário): por isso, com
 * `pairingUrl` (servidor só IPv4), pergunta nos dois endereços e junta as respostas.
 */
export async function getAvailable(signal?: AbortSignal, pairingUrl = env.pairingUrl) {
  const ask = (baseUrl?: string) =>
    http("/pairing/available", { signal, baseUrl }, availableSchema);
  if (!pairingUrl) return ask();

  const [main, v4] = await Promise.allSettled([ask(), ask(pairingUrl)]);
  if (main.status === "rejected" && v4.status === "rejected") throw main.reason;
  const found = new Map<string, AvailableDevice>();
  for (const result of [v4, main]) {
    if (result.status === "fulfilled") {
      for (const d of result.value.devices) found.set(d.serial, d);
    }
  }
  return { devices: [...found.values()] };
}

export function postClaim(input: ClaimInput) {
  return http("/pairing/claim", { method: "POST", body: input }, claimedSchema);
}

export function postSignup(input: SignupInput) {
  return http("/pairing/signup", { method: "POST", body: input }, claimedSchema);
}
