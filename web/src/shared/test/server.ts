import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

// Mesmo valor de VITE_API_URL no ambiente de teste (vite.config.ts).
export const API = "http://localhost:3333/api";

/** Respostas padrão da API; cada teste pode sobrescrever com server.use(...). */
export const handlers = [
  http.get(`${API}/auth/me`, () =>
    HttpResponse.json({ id: "u1", email: "dono@example.com" }),
  ),
  http.post(`${API}/auth/logout`, () => new HttpResponse(null, { status: 204 })),
];

export const server = setupServer(...handlers);
