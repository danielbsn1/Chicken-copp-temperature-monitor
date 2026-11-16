# Avitech — monitor de temperatura do galinheiro

Um ESP32 mede a temperatura, liga o ventilador sozinho (30 °C liga, 28 °C desliga) e envia o histórico em lotes de 15 min para um painel web. O controle é local e não depende de internet; a nuvem só guarda, mostra e vigia.

O design completo está em [docs/](docs/).

## Estrutura

| Pasta | Conteúdo |
| --- | --- |
| `api/` | Back-end (Node.js, Express, Prisma) |
| `web/` | Painel (React, Vite) |
| `firmware/` | ESP32 (PlatformIO) |
| `docs/` | System design e diagramas |
| `.github/` | Workflows, Dependabot, modelo de pull request e CODEOWNERS |

Na raiz também ficam `docker-compose.yml` (Postgres local), `.editorconfig`, `.gitignore` e `.nvmrc`.

## Requisitos

- Node.js 22 (`.nvmrc`) e pnpm
- Docker, para o Postgres local
- PlatformIO, para o firmware

## Ambiente local

1. Suba o Postgres 16 (porta 5433, volume nomeado):

   ```
   docker compose up -d
   ```

2. Copie as variáveis de cada app e preencha. Os arquivos `.env` ficam fora do Git.

   ```
   cp api/.env.example api/.env
   cp web/.env.example web/.env.local
   ```

3. Instale as dependências, aplique as migrações e inicie a API (http://localhost:3333):

   ```
   cd api
   pnpm install
   pnpm db:deploy
   pnpm dev
   ```

4. Em outro terminal, inicie o painel (http://localhost:5173):

   ```
   cd web
   pnpm install
   pnpm dev
   ```

## Scripts

Cada app tem os scripts no próprio `package.json`; o mesmo comando roda no computador e na pipeline.

| App | Scripts |
| --- | --- |
| `api/` | `dev`, `lint`, `format:check`, `typecheck`, `depcruise`, `test`, `build`, `db:deploy`, `device:create`, `user:create` |
| `web/` | `dev`, `lint`, `typecheck`, `build`, `preview` |

`pnpm device:create` cadastra um dispositivo (ou troca a chave dele) e mostra a chave uma única vez.

## Firmware

```
cd firmware
cp include/secrets.example.h include/secrets.h   # preencha
pio run
pio run -t upload
```

## Branches e pull requests

| Branch | Papel | Merge |
| --- | --- | --- |
| `main` | Produção | Merge commit, vindo de `development` |
| `development` | Integração e staging | Squash, vindo de `feat/*` e `fix/*` |
| `feat/<módulo>` e `fix/<assunto>` | Uma alteração por branch, criada a partir da última `development` | Apagada após o merge |

- Ninguém faz push direto em `main` nem em `development`; toda alteração entra por pull request, com o check `ci` verde e 1 aprovação.
- O título do pull request segue `tipo(escopo): descrição`, com tipo `feat`, `fix`, `refactor`, `test`, `docs`, `ci` ou `chore`. Exemplo: `feat(auth): login com cookie de sessão`.
- O pull request de `development` para `main` leva o título `release: AAAA-MM-DD`.
