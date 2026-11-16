import { z } from "zod";
import { http } from "../../shared/api/http";
import { sessionSchema, type Session } from "./auth.schemas";

export function getSession(signal?: AbortSignal): Promise<Session> {
  return http("/auth/me", { signal }, sessionSchema);
}

export function postLogout(): Promise<void> {
  return http("/auth/logout", { method: "POST" }, z.undefined());
}
