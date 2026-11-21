import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

// Mesmo valor de VITE_API_URL no ambiente de teste (vite.config.ts).
export const API = "http://localhost:3333/api";

/** Respostas padrão da API; cada teste pode sobrescrever com server.use(...). */
export const handlers = [
  http.get(`${API}/auth/me`, () =>
    HttpResponse.json({ id: "u1", email: "dono@example.com" }),
  ),
  http.get(`${API}/devices`, () =>
    HttpResponse.json({
      devices: [
        {
          id: "galinheiro-teste",
          name: "Galinheiro teste",
          lastSeenAt: null,
          fwVersion: null,
        },
      ],
    }),
  ),
  http.get(`${API}/status`, () =>
    HttpResponse.json({
      reading: { ts: new Date().toISOString(), tempC: 27.4, humPct: 62, fanOn: false },
      fanOn: false,
      lastSeenAt: new Date().toISOString(),
      fwVersion: "2.0.1",
    }),
  ),
  http.get(`${API}/readings`, ({ request }) => {
    const url = new URL(request.url);
    return HttpResponse.json({
      deviceId: url.searchParams.get("deviceId"),
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
      bucket: url.searchParams.get("bucket"),
      points: [
        { ts: "2026-11-14T13:00:00.000Z", minC: 26, avgC: 27, maxC: 28.5 },
        { ts: "2026-11-14T13:05:00.000Z", minC: 27, avgC: 29, maxC: 31 },
      ],
    });
  }),
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
  http.get(`${API}/reports/daily`, ({ request }) => {
    const url = new URL(request.url);
    return HttpResponse.json({
      deviceId: url.searchParams.get("deviceId"),
      day: url.searchParams.get("day"),
      tempMinC: 22.1,
      tempMaxC: 33.9,
      tempAvgC: 27.5,
      fanOnMinutes: 90,
      readingsCount: 1380,
    });
  }),
  http.post(`${API}/auth/logout`, () => new HttpResponse(null, { status: 204 })),
];

export const server = setupServer(...handlers);
