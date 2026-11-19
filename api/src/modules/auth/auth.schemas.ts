import { z } from "zod";

const email = z.string().trim().toLowerCase().pipe(z.email());

export const loginBody = z.object({
  email,
  password: z.string().min(1).max(200),
});

/** Dados do `pnpm user:create`: a senha precisa ter pelo menos 12 caracteres. */
export const registerInput = z.object({
  email,
  password: z.string().min(12).max(200),
});

export interface AuthUser {
  id: string;
  email: string;
}
