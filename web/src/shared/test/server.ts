import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

// Mesmo valor de VITE_API_URL no ambiente de teste (vite.config.ts).
export const API = "http://localhost:3333/api";

/** Respostas padrão da API; cada teste pode sobrescrever com server.use(...). */
export const handlers = [
  http.get(`${API}/auth/me`, () =>
    HttpResponse.json({ id: "u1", email: "dono@example.com" }),
  ),
  http.get(`${API}/events`, ({ request }) => {
    const url = new URL(request.url);
    return HttpResponse.json({
      deviceId: url.searchParams.get("deviceId"),
      events: [
        { ts: "2026-11-14T13:05:00.000Z", type: "fan_off", detail: null },
        { ts: "2026-11-14T13:00:00.000Z", type: "fan_on", detail: { tempC: 31 } },
      ],
    });
  }),
  http.post(`${API}/auth/logout`, () => new HttpResponse(null, { status: 204 })),
];

export const server = setupServer(...handlers);
