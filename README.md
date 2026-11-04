<<<<<<< HEAD
# Monitor de temperatura do galinheiro

Um ESP32 mede a temperatura, liga o ventilador sozinho (30 °C liga, 28 °C desliga) e envia o histórico para um painel web. O controle é local e não depende de internet; a nuvem só guarda, mostra e vigia.

Design completo em [docs/](docs/): o roteiro e o diagrama de arquitetura.

## Estrutura

| Pasta | Conteúdo |
| --- | --- |
| `firmware/` | ESP32 (PlatformIO) |
| `api/` | Backend Node.js + TypeScript (Fastify, Prisma) |
| `web/` | Painel React (Vite) |
| `docs/` | Roteiro e diagrama |

## Requisitos

- Node.js 24 (`.nvmrc`) e pnpm
- Docker, para o Postgres local
- PlatformIO, para o firmware

## Rodar a API e o painel

```
# API (http://localhost:3333, documentação em /docs)
cd api
pnpm install
pnpm dev

# Painel (http://localhost:5173)
cd web
pnpm install
pnpm dev
```

O banco (Postgres no Docker) entra na Fase 2: `cp .env.example api/.env` e `docker compose up -d`. Em produção o banco é o Aurora DSQL.

## Contrato OpenAPI

A API gera o `api/openapi.json` a partir dos schemas `zod`, e o painel gera os tipos a partir dele:

```
cd api && pnpm openapi:export   # atualiza api/openapi.json
cd web && pnpm gen:api          # atualiza web/src/api/schema.d.ts
```

Os dois arquivos vão para o Git, e o CI falha se algum estiver desatualizado.

## CI (GitHub Actions)

Um workflow por pasta, que roda só quando ela muda: `api` (lint, tipos, testes, build e OpenAPI atualizado), `web` (tipos da API, lint, tipos e build) e `firmware` (`pio run`).

## Firmware

```
cd firmware
cp include/secrets.example.h include/secrets.h   # preencha
pio run
pio run -t upload
```

## Status

Em planejamento. As fases estão no roteiro em `docs/`.
=======
# Chicken-copp-temperature-monitor
>>>>>>> e24db33aa0b9bc3cdc0c8db2259ecf4578f17744
