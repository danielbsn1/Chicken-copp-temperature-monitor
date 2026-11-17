# Mapa de ambientes

Sem valores secretos. Segredos ficam só nas variáveis da Vercel e nos secrets dos GitHub Environments.

## Projetos da Vercel (time `avitech1`)

| Ambiente | Projeto | Pasta raiz | Endereço atual |
| --- | --- | --- | --- |
| Staging | `avitech-api-staging` | `api/` | `https://avitech-api-staging.vercel.app` |
| Staging | `avitech-web-staging` | `web/` | `https://avitech-web-staging.vercel.app` |
| Produção | `avitech-api-production` | `api/` | `https://avitech-api-production.vercel.app` |
| Produção | `avitech-web-production` | `web/` | `https://avitech-web-production.vercel.app` |

- A integração automática com o Git está desligada nos quatro: a publicação é feita só pelos workflows.
- A função da API roda em `gru1` (São Paulo), a mesma região dos bancos no Supabase (`api/vercel.json`, campo `regions`). O plano Hobby permite uma região por projeto.
- `api/vercel.json` encaminha `/api/*` para a função única e declara o cron `0 10 * * *` (07:00 em America/Sao_Paulo).

## Variáveis

Cada projeto usa o ambiente *Production* da Vercel; os dois ambientes se separam pelo projeto.

### API (`avitech-api-*`)

| Variável | Tipo | Valor / origem |
| --- | --- | --- |
| `NODE_ENV` | config | `production` |
| `WEB_ORIGIN` | config | origem do painel do mesmo ambiente (sem barra final) |
| `DATABASE_URL` | secreta | pooler do Supabase em modo transação, papel `avitech_app` (ver `docs/supabase.md`) |
| `SESSION_SECRET` | secreta | aleatório, um por ambiente |
| `CRON_SECRET` | secreta | aleatório, um por ambiente |
| `TELEGRAM_BOT_TOKEN` | secreta | bot do Telegram |
| `TELEGRAM_CHAT_ID` | secreta | conversa que recebe os alertas |
| `HC_PING_URL` | secreta | URL de ping do Healthchecks do ambiente |

### Painel (`avitech-web-*`)

| Variável | Tipo | Valor / origem |
| --- | --- | --- |
| `VITE_API_URL` | config | URL da API do mesmo ambiente, incluindo `/api` |
| `VITE_DEVICE_ID` | config | `devices.id` do galinheiro |

`VITE_*` vai para o navegador; por isso nada secreto entra nessas variáveis.

## Domínios

O plano é `app.<domínio>` e `api.<domínio>` em produção, `app-staging.<domínio>` e `api-staging.<domínio>` no staging, para o cookie `SameSite=Lax` da API ser enviado. Enquanto não houver domínio próprio, valem os endereços `.vercel.app` acima.

Atenção: `vercel.app` está na lista de sufixos públicos, então `avitech-web-*.vercel.app` e `avitech-api-*.vercel.app` são sites diferentes e o navegador não envia o cookie `SameSite=Lax` do painel para a API. O login por cookie só funciona com os dois sob um domínio próprio comum.

## Deployment Protection

Em Hobby vem ligada (Standard Protection): protege as URLs de preview, e o endereço de produção continua público. O painel e o ESP32 precisam alcançar a API de staging sem login na Vercel; conferir depois do primeiro deploy da API.
