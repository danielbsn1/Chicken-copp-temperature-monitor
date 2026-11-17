&#91;image: Logo Avitech\]

# Back-end — System design do Avitech

Nov 14, 2026 · @daniel

O back-end do Avitech é uma API Node.js com Express organizada como monolito modular: um único serviço dividido em módulos por funcionalidade, com camadas e regras de dependência fixas. Este documento define a arquitetura, as pastas, os módulos, o contrato da API e a implantação, para a equipe implementar sem precisar decidir nada além do que está aqui.

## 1. Arquitetura

A arquitetura é um **monolito modular em camadas por funcionalidade**: um único serviço Express, dividido em módulos (`auth`, `devices`, `ingest`, `readings`, `events`, `reports`, `notifications`, `health`). Cada módulo tem as mesmas quatro camadas (rota, controlador, serviço e repositório) e só conversa com os outros pela sua interface pública.

## 2. Stack

| Camada | Tecnologia | Uso |
| --- | --- | --- |
| Runtime | Node.js 22 LTS | Execução da API |
| Linguagem | TypeScript em modo estrito | Tipagem em todo o código |
| Framework web | Express | Rotas e middlewares |
| Validação | zod | Corpo, parâmetros, consultas e variáveis de ambiente |
| Acesso ao banco | Prisma com o adaptador `pg` | Consultas, transações e migrações (Postgres no Supabase) |
| Senhas | scrypt, do módulo `crypto` do Node | Hash de senhas |
| Segurança HTTP | helmet, cors, express-rate-limit | Cabeçalhos, origem permitida e limites de uso |
| Logs | pino com pino-http | Logs JSON com identificador de requisição |
| Testes | Vitest e supertest | Unitários e de integração |
| Qualidade | ESLint, Prettier e dependency-cruiser | Estilo e regras de dependência entre módulos |
| Pacotes | pnpm | Gerenciador de dependências |

## 3. Estrutura de pastas

O código fica em `api/`. A pasta `core/` guarda o que é compartilhado e não conhece nenhum módulo; cada pasta de `modules/` guarda uma funcionalidade completa.

```
api/
  prisma/
    schema.prisma
    migrations/
  src/
    app.ts            # createApp(): monta middlewares e routers
    server.ts         # app.listen(), só para desenvolvimento local
    config/
      env.ts            # lê e valida as variáveis de ambiente (zod)
    core/
      db.ts             # cliente Prisma único
      logger.ts
      errors.ts         # AppError e subclasses
      http/
        error-handler.ts
        request-id.ts
        validate.ts       # middleware que aplica um schema zod
        guards.ts         # requireUser, requireDevice, requireCronSecret
    modules/
      auth/
      devices/
      ingest/
      readings/
      events/
      reports/
      notifications/
      health/
        # cada módulo tem: index.ts, *.routes.ts, *.controller.ts,
        #   *.service.ts, *.repository.ts, *.schemas.ts, *.test.ts
  api/
    index.ts            # entrada da Vercel: exporta o app
  scripts/
    device-create.ts    # pnpm device:create
    user-create.ts      # pnpm user:create
  vercel.json
```

O arquivo `app.ts` não chama `listen`: ele só monta o app. Assim os testes, o servidor local (`server.ts`) e a função da Vercel (`api/index.ts`) usam o mesmo app.

Os scripts de operação ficam em `api/scripts/` e são chamados pelo `package.json`: `pnpm db:deploy` aplica as migrações, `pnpm device:create` cadastra um dispositivo (ou troca a chave dele) e mostra a chave uma única vez, e `pnpm user:create` cadastra um usuário do painel.

## 4. Módulos

Cada módulo tem uma responsabilidade única e uma interface pública no arquivo `index.ts`. A coluna "Usa" lista os módulos de que ele depende, sempre pela interface pública.

| Módulo | Responsabilidade | Endpoints | Usa | Tabelas |
| --- | --- | --- | --- | --- |
| auth | Login, logout, sessão por cookie e limite de tentativas | `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` |  | users, login\_attempts |
| devices | Cadastro e autenticação do dispositivo pela chave; status atual | `GET /api/status` | readings | devices |
| ingest | Receber o lote do ESP32, validar e gravar numa transação | `POST /api/ingest` | devices, readings, events, health |  |
| readings | Gravar e consultar leituras de temperatura e umidade | `GET /api/readings` |  | readings |
| events | Gravar e consultar eventos do dispositivo | `GET /api/events` |  | events |
| reports | Calcular, gravar e servir o resumo diário; limpeza de dados antigos; job das 7 h | `GET /api/reports/daily`, `GET /api/jobs/daily-report` | auth, readings, events, notifications | daily\_summary |
| notifications | Enviar mensagens ao Telegram |  |  |  |
| health | Verificação de vida da API e aviso ao Healthchecks | `GET /api/health` |  |  |

A gravação do lote atravessa três módulos na mesma transação. Para isso, as funções públicas de `readings`, `events` e `devices` aceitam um parâmetro opcional com o cliente da transação do Prisma, e o `ingest` abre a transação e a repassa:

```ts
await db.$transaction(async (tx) => {
  await readings.saveMany(batch.samples, tx);
  await events.saveMany(batch.events, tx);
  await devices.touch(device.id, tx);
});
```

## 5. Camadas dentro de um módulo e regras de dependência

Uma requisição atravessa as camadas sempre na mesma ordem: rota, controlador, serviço, repositório e banco. Cada camada só chama a seguinte.

| Camada | Arquivo | Faz | Não faz |
| --- | --- | --- | --- |
| Rota | `*.routes.ts` | Liga a URL e o método ao controlador, com os middlewares (guarda, validação) | Lógica de negócio |
| Controlador | `*.controller.ts` | Lê a requisição já validada, chama o serviço e monta a resposta HTTP | Acessar o banco; conter regra de negócio |
| Serviço | `*.service.ts` | Aplica as regras de negócio e coordena repositórios e outros módulos | Importar `express`; conhecer HTTP |
| Repositório | `*.repository.ts` | Executa as consultas do Prisma | Regras de negócio |
| Schemas | `*.schemas.ts` | Define com zod o formato de entrada e saída | Qualquer lógica |

Regras de dependência, verificadas no CI pelo dependency-cruiser (o build falha se alguma for quebrada):

1. Um módulo só importa de outro módulo pelo `index.ts` dele, nunca pelos arquivos internos.
2. Os módulos formam um grafo sem ciclos: dois módulos não dependem um do outro.
3. O `core/` não importa de nenhum módulo.
4. Só o controlador e a rota importam `express`.
5. Só o repositório importa o cliente do Prisma; o serviço usa o repositório.
6. O `app.ts` é o único arquivo que conhece todos os módulos, para registrá-los.

## 6. Núcleo compartilhado (core)

O `core/` reúne o que todos os módulos usam e não tem regra de negócio.

| Arquivo | O que oferece |
| --- | --- |
| `db.ts` | Cliente Prisma único por processo, conectado pela URL do pooler |
| `logger.ts` | Logger pino; cada requisição ganha um `requestId` |
| `errors.ts` | Classe `AppError` (com `status`, `code` e `message`) e as subclasses `ValidationError` (400), `UnauthorizedError` (401), `ForbiddenError` (403), `NotFoundError` (404), `ConflictError` (409) e `RateLimitError` (429) |
| `http/request-id.ts` | Gera ou repassa o cabeçalho `X-Request-Id` |
| `http/validate.ts` | Middleware que valida `body`, `params` e `query` com um schema zod e devolve 400 com os detalhes |
| `http/guards.ts` | `requireUser` (cookie de sessão), `requireDevice` (cabeçalho `X-Device-Key`) e `requireCronSecret` (cabeçalho `Authorization: Bearer`) |
| `http/error-handler.ts` | Último middleware: converte qualquer erro em JSON no formato padrão e registra no log; erros não previstos viram 500 sem expor detalhes |

Um controlador nunca captura erro: ele apenas lança, e o `error-handler` responde.

## 7. Contrato da API

Convenções válidas para todos os endpoints:

- Prefixo `/api`, corpo e resposta em JSON, nomes de campos em `camelCase`.
- Datas em ISO 8601, sempre em UTC (por exemplo `2026-11-14T10:00:00Z`).
- Corpo limitado a 100 KB.
- Toda resposta traz o cabeçalho `X-Request-Id`.
- Erros têm sempre o mesmo formato: `{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [...] } }`; `details` só aparece em erros de validação.

| Endpoint | Autenticação | Entrada | Resposta |
| --- | --- | --- | --- |
| `POST /api/ingest` | `X-Device-Key` | `deviceId`, `fwVersion`, `samples[]` e `events[]`, com até 100 itens cada | 200 com `accepted`, `duplicates` e `rejected` |
| `POST /api/auth/login` | nenhuma | `email` e `password` | 200 com cookie de sessão; 401 se inválido; 429 após 5 falhas em 15 min |
| `POST /api/auth/logout` | cookie | nenhuma | 204 e cookie removido |
| `GET /api/auth/me` | cookie | nenhuma | 200 com `id` e `email` |
| `GET /api/status` | cookie | `deviceId` | Última leitura, `fanOn`, `lastSeenAt` e `fwVersion` |
| `GET /api/readings` | cookie | `deviceId`, `from`, `to`, `bucket` (`1m`, `5m`, `15m` ou `1h`) | Até 1.000 pontos agregados por intervalo (mínima, média e máxima de temperatura) |
| `GET /api/events` | cookie | `deviceId`, `from`, `to`, `type` (opcional), `limit` (até 200) | Lista de eventos, do mais novo para o mais antigo |
| `GET /api/reports/daily` | cookie | `deviceId`, `day` e `format` (`json` ou `csv`) | Resumo do dia |
| `GET /api/jobs/daily-report` | `Authorization: Bearer` com o `CRON_SECRET` | nenhuma | 200 após gravar o resumo, enviar ao Telegram e limpar dados antigos |
| `GET /api/health` | nenhuma | nenhuma | 200 com `status: "ok"` |

Campos do lote de `POST /api/ingest`; cada campo corresponde a uma coluna do documento do banco de dados:

| Campo | Tipo | Coluna no banco |
| --- | --- | --- |
| `deviceId` | texto | `devices.id` (chave estrangeira das três tabelas de dados) |
| `fwVersion` | texto | `devices.fw_version` |
| `samples[].ts` | ISO 8601 UTC; aceito de 48 h atrás até 5 min à frente | `readings.ts` (arredondado ao minuto) |
| `samples[].tempC` | número entre -10 e 60 | `readings.temp_c` |
| `samples[].humPct` | número entre 0 e 100 | `readings.hum_pct` |
| `samples[].fanOn` | booleano | `readings.fan_on` |
| `events[].ts` | ISO 8601 UTC; mesma janela das amostras | `events.ts` |
| `events[].type` | texto, um de: fan\_on, fan\_off, temp\_critical, sensor\_failure, sensor\_recovered, boot, connectivity\_restored (os mesmos do CHECK de `events.type` | `events.type` |
| `events[].detail` | objeto JSON, opcional; chaves por tipo: tempC (fan\_on, fan\_off, temp\_critical), consecutiveFailures (sensor\_failure), downSeconds (sensor\_recovered), reason: power\_on, watchdog ou software (boot), offlineSeconds e droppedSamples (connectivity\_restored) | `events.detail` |

Item fora da janela ou fora dos limites entra em `rejected`; o restante do lote é gravado.

Códigos de status: 200 e 204 em sucesso; 400 para entrada inválida; 401 sem autenticação ou com credencial inválida; 404 para recurso inexistente; 429 para excesso de tentativas; 500 para falha não prevista.

## 8. Segurança e configuração

A segurança dos dados (hashes, papel do banco, RLS) está no documento do banco de dados. No back-end valem estas regras:

- `helmet` ativo em toda a API.
- CORS, com envio de cookies permitido, aceita somente a origem do painel, definida em `WEB_ORIGIN`.
- O cookie de sessão é `httpOnly`, assinado com `SESSION_SECRET`, válido por 7 dias, com `secure` em produção e `sameSite` em `lax`.
- O login conta falhas na tabela `login_attempts`; após 5 em 15 min, responde 429.
- O `/api/ingest` tem limite de 30 requisições por minuto por dispositivo.
- Nenhum segredo, chave ou senha vai para o log; a chave do dispositivo nunca é registrada.
- Todas as variáveis são validadas na inicialização por `config/env.ts`; se faltar alguma, o processo não sobe.

| Variável | Uso |
| --- | --- |
| `NODE_ENV` | `development`, `test` ou `production` |
| `DATABASE_URL` | Conexão pelo pooler do Supabase (usada pela API) |
| `DIRECT_URL` | Conexão direta (usada só nas migrações) |
| `SESSION_SECRET` | Assinatura do cookie de sessão |
| `CRON_SECRET` | Protege o endpoint do job diário |
| `TELEGRAM_BOT_TOKEN` | Token do bot do Telegram |
| `TELEGRAM_CHAT_ID` | Conversa que recebe os avisos |
| `HC_PING_URL` | Endereço de ping do Healthchecks |
| `WEB_ORIGIN` | Origem permitida pelo CORS (o painel): app. em produção e app-staging. no staging, no mesmo domínio da API |

## 9. Erros, logs e testes

**Erros.** Os serviços lançam `AppError` (ou uma subclasse) para falhas esperadas. O `error-handler` responde com o status e o formato padrão. Qualquer outro erro vira 500 com a mensagem genérica `Erro interno`, e o detalhe vai só para o log.

**Logs.** O pino escreve uma linha JSON por requisição, com `requestId`, método, rota, status e duração; nas rotas do dispositivo, também o `deviceId`. Os níveis são `error` para falhas, `warn` para erros do cliente repetidos e `info` para o fluxo normal.

| Tipo de teste | O que cobre | Ferramenta | Banco |
| --- | --- | --- | --- |
| Unitário | Regras dos serviços, como janela de `ts`, arredondamento ao minuto e cálculo do resumo | Vitest | Repositórios substituídos por funções falsas |
| Integração | Cada endpoint, da requisição à resposta, incluindo autenticação e erros | Vitest e supertest | Postgres 16 descartável, o mesmo do CI |
| Contrato do `/ingest` | Lote válido, lote repetido (duplicados), item com `ts` inválido e chave inválida | Vitest e supertest | Postgres 16 descartável |

A cobertura mínima é de 80 % nos arquivos `*.service.ts`. O CI (seção 11) roda, nesta ordem: ESLint, Prettier, verificação de tipos, dependency-cruiser, testes, `db:deploy` no banco descartável e, por fim, o build.

## 10. Implantação na Vercel

A API roda como uma função serverless da Vercel que exporta o mesmo app Express usado nos testes.

- `api/index.ts` importa `createApp()` e exporta o app; a Vercel o executa como função.
- O `vercel.json` encaminha todas as rotas `/api/*` para essa única função e declara o agendamento do job diário:

```json
{
  "rewrites": [{ "source": "/api/(.*)", "destination": "/api" }],
  "crons": [{ "path": "/api/jobs/daily-report", "schedule": "0 10 * * *" }]
}
```

- O agendamento `0 10 * * *` está em UTC e corresponde a 7 h em America/Sao\_Paulo. A Vercel envia o cabeçalho `Authorization: Bearer` com o valor de `CRON_SECRET`, que o `requireCronSecret` confere.
- O cliente Prisma é criado uma vez por processo, fora do manipulador, e o pool de cada função tem no máximo 1 conexão.
- A região da função é a mesma do banco no Supabase.
- Fluxo de publicação (detalhado no documento "Repositório e pipelines"): o CI passa, o `db:deploy` aplica as migrações pela conexão direta e, em seguida, a Vercel publica a API.

## 11. Integração e entrega contínuas

Branches, regras de merge, ambientes, segredos e workflows de deploy estão no documento "Repositório e pipelines". Esta seção define apenas o job `api` do workflow `ci`.

O job `api` roda em todo pull request para `development` e `main`, junto com o job `web`. Os passos abaixo executam na ordem; o primeiro que falhar bloqueia o merge.

| Passo | Comando | Falha quando |
| --- | --- | --- |
| 1. Instalação | `pnpm install --frozen-lockfile` | O lockfile não bate com o `package.json` |
| 2. ESLint | `pnpm lint` | Há qualquer erro ou aviso |
| 3. Prettier | `pnpm format:check` | Algum arquivo está fora do padrão |
| 4. Tipos | `pnpm typecheck` (`tsc --noEmit`) | Há erro de tipo |
| 5. Fronteiras | `pnpm depcruise` | Uma regra de dependência da seção 5 é quebrada |
| 6. Testes | `pnpm test --coverage` | Um teste falha ou a cobertura dos `*.service.ts` fica abaixo de 80 % |
| 7. Migrações | `pnpm db:deploy` num Postgres 16 descartável | Uma migração não aplica |
| 8. Build | `pnpm build` | O código não compila |

Cada passo é um script do `package.json` de `api/`, para que o mesmo comando rode no computador do dev e na pipeline. Ao final da pipeline, o job agregador `ci` consolida o resultado dos jobs `api` e `web`.
