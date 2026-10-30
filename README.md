<<<<<<< HEAD
# Monitor de temperatura do galinheiro

Um ESP32 mede a temperatura, liga o ventilador sozinho (30 °C liga, 28 °C desliga) e envia o histórico para um painel web. O controle é local e não depende de internet; a nuvem só guarda, mostra e vigia.

Design completo em [docs/](docs/): o roteiro e o diagrama de arquitetura.

## Estrutura

| Pasta | Conteúdo |
| --- | --- |
| `firmware/` | ESP32 (PlatformIO) |
| `web/` | Painel React e API (Next.js, Vercel) |
| `docs/` | Roteiro e diagrama |

## Requisitos

- Node.js 22 (`.nvmrc`) e pnpm
- Docker, para o Postgres local
- PlatformIO, para o firmware

## Rodar o painel e a API (a partir da Fase 2)

```
cp .env.example web/.env.local
docker compose up -d
cd web
pnpm install
pnpm db:migrate
pnpm dev
```

Em produção o banco é o Aurora DSQL; o Postgres do Docker é só para desenvolvimento.

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
