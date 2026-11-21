import { http } from "../../shared/api/http";
import {
  availableSchema,
  claimedSchema,
  devicesSchema,
  type ClaimInput,
  type SignupInput,
} from "./devices.schemas";

export function getDevices(signal?: AbortSignal) {
  return http("/devices", { signal }, devicesSchema);
}

/** Equipamentos com o botão de pareamento apertado, vistos do mesmo IP de quem pergunta. */
export function getAvailable(signal?: AbortSignal) {
  return http("/pairing/available", { signal }, availableSchema);
}

export function postClaim(input: ClaimInput) {
  return http("/pairing/claim", { method: "POST", body: input }, claimedSchema);
}

export function postSignup(input: SignupInput) {
  return http("/pairing/signup", { method: "POST", body: input }, claimedSchema);
}
