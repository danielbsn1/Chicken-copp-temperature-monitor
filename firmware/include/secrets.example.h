#pragma once

// Copie para secrets.h (ignorado pelo Git) e preencha.
#define WIFI_SSID ""
#define WIFI_PASSWORD ""
#define API_URL "https://SEU-PROJETO.vercel.app/api/ingest"
// Certificado raiz (PEM) da cadeia do servidor da API; sem ele o aparelho não se anuncia.
// Para pegar: openssl s_client -showcerts -connect SEU-PROJETO.vercel.app:443 </dev/null
// e copie o último certificado da cadeia (a raiz), uma linha por \n.
#define API_ROOT_CA ""
#define TELEGRAM_BOT_TOKEN ""
#define TELEGRAM_CHAT_ID ""
