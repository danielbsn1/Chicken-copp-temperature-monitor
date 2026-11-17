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

## Deploy

| Workflow | Gatilho | Environment | O que faz |
| --- | --- | --- | --- |
| `deploy-staging.yml` | push em `development` | `staging` | `db:deploy`, publica a API, confere `/api/health`, publica o front-end |
| `deploy-production.yml` | push em `main` | `production` (aprovação manual) | os mesmos passos, em produção |

Ordem: as migrações vêm primeiro, então código novo nunca roda sobre esquema antigo; se `db:deploy` falhar, nada é publicado. A API é publicada e verificada antes do front-end. O health check exige HTTP 200 (até 6 tentativas) e, se falhar, o job falha. Os workflows não rodam em pull requests, usam `cancel-in-progress: false` e `timeout-minutes: 15`.

Cada projeto da Vercel usa só o ambiente *Production*, por isso os dois workflows publicam com `--prod`; o staging é separado pelo projeto, não pelo tipo de deploy. A publicação é feita pela CLI (`pull`, `build`, `deploy --prebuilt`), já que o Git integrado da Vercel está desligado.

Secrets de cada GitHub Environment (`staging` e `production`), sem valores no repositório:

| Secret | Uso |
| --- | --- |
| `VERCEL_TOKEN` | autentica a CLI da Vercel |
| `VERCEL_ORG_ID` | time `avitech1` |
| `VERCEL_PROJECT_ID_API` | projeto `avitech-api-*` do ambiente |
| `VERCEL_PROJECT_ID_WEB` | projeto `avitech-web-*` do ambiente |
| `DIRECT_URL` | conexão direta do Postgres, só no `db:deploy` |

O endereço usado no health check (`API_URL`) está no topo de cada workflow; mude-o ao ganhar domínio próprio.

## Backup

O plano gratuito do Supabase não inclui backups do projeto, então o `backup.yml` faz um `pg_dump` diário do banco de produção.

| Item | Definição |
| --- | --- |
| Agenda | todo dia às 07:00 UTC (antes do resumo diário das 10:00 UTC) e por `workflow_dispatch` |
| Formato | `pg_dump --format=custom --compress=9`, arquivo `avitech-AAAAMMDDTHHMMSSZ.dump` |
| Destino | bucket privado `backups` no Storage do projeto Supabase de **staging** (projeto separado do de produção) |
| Retenção | 30 dias; depois de conferir o envio, o workflow apaga o que for mais antigo |
| Falha | o workflow abre uma issue atribuída ao dono do repositório |
| Sigilo | o dump fica só no runner e é apagado; não há `upload-artifact` e nada vai para o Git |

Decisão registrada: o armazenamento é do próprio Supabase (outro projeto da mesma conta). Protege contra perder o banco de produção, mas não contra perder a conta do Supabase; o critério "externo ao Supabase" da história foi dispensado.

Secrets do Environment `production`:

| Secret | Uso |
| --- | --- |
| `BACKUP_DATABASE_URL` | papel `avitech_backup` (só `SELECT`, com `BYPASSRLS`); usar o **pooler em modo sessão** (porta 5432), porque a conexão direta é IPv6 e o `pg_dump` não funciona no modo transação |
| `BACKUP_STORAGE_KEY` | chave de serviço (`service_role`) do projeto de staging, para gravar no bucket |

Restauração: baixar o `.dump` do bucket e rodar `pg_restore --no-owner --dbname=<banco novo> arquivo.dump`, num banco à parte.
