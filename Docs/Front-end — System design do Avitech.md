&#91;image: Logo Avitech\]

# Front-end — System design do Avitech

Nov 14, 2026 · @daniel

O front-end do Avitech é o painel web em que o operador consulta a situação do galinheiro, o histórico de temperatura, os eventos e o resumo diário. É uma aplicação React de página única, organizada em módulos por funcionalidade, com camadas e regras de dependência fixas. Este documento define a arquitetura, as pastas, os módulos, as telas, a integração com a API, a qualidade e a implantação, para a equipe implementar sem precisar decidir nada além do que está aqui.

## 1. Arquitetura

O painel é uma aplicação de página única (SPA) em React com TypeScript, dividida em **módulos por funcionalidade**: `auth`, `status`, `readings`, `events` e `reports`. Cada módulo tem as mesmas camadas (página, componentes, hooks e api) e só é acessado pela sua interface pública, o `index.ts`. Nenhum módulo importa outro; a pasta `app/` é a única que conhece todos e monta as telas.

O painel só exibe dados: não envia comandos ao dispositivo. Toda a comunicação é com a API do Avitech (documento do back-end), por HTTPS, com cookie de sessão. As regras de dependência são verificadas no CI (seção 11).

## 2. Stack

| Camada | Tecnologia | Uso |
| --- | --- | --- |
| Build e servidor local | Vite, com Node.js 22 LTS | Desenvolvimento (`pnpm dev`) e build de produção |
| Linguagem | TypeScript em modo estrito | Tipagem em todo o código |
| Interface | React 19 | Componentes e páginas |
| Rotas | React Router | Navegação entre as telas, com carga sob demanda das páginas |
| Dados da API | TanStack Query | Consultas, cache, atualização periódica e estados de carregamento e erro |
| Validação | zod | Respostas da API e variáveis de ambiente |
| Gráficos | Recharts | Gráfico de temperatura |
| Estilo | CSS Modules com variáveis CSS | Estilos por componente e cores, espaçamentos e fontes em variáveis |
| Datas e números | `Intl` do navegador | Formatação em pt-BR e fuso America/Sao\_Paulo |
| Testes | Vitest, Testing Library e MSW | Unitários e de componentes, com a API simulada |
| Qualidade | ESLint (com jsx-a11y), Prettier e dependency-cruiser | Estilo, acessibilidade e regras de dependência |
| Pacotes | pnpm | Gerenciador de dependências |

## 3. Estrutura de pastas

O código fica em `web/`, ao lado de `api/`. A pasta `shared/` e a `config/` guardam o que é comum e não conhecem nenhum módulo; cada pasta de `modules/` guarda uma funcionalidade completa.

```
web/
  index.html
  vite.config.ts
  vercel.json
  src/
    main.tsx              # monta o React
    app/
      App.tsx             # provedores (TanStack Query, Router)
      routes.tsx          # tabela de rotas e proteção das privadas
      query-client.ts     # configuração única do TanStack Query
      layout/
        AppLayout.tsx     # cabeçalho, menu e botão Sair
      pages/
        PainelPage.tsx    # monta status, gráfico e eventos
        NotFoundPage.tsx
    config/
      env.ts              # lê e valida as variáveis VITE_* (zod)
    shared/
      api/
        http.ts           # cliente HTTP único
        errors.ts         # ApiError
      ui/                 # componentes visuais sem regra de negócio
      format/
        date.ts
        number.ts
      test/
        server.ts         # servidor MSW
        render.tsx        # render com provedores
    modules/
      auth/
      status/
      readings/
      events/
      reports/
        # cada módulo tem: index.ts, *.page.tsx (quando tem tela própria),
        #   components/, *.hooks.ts, *.api.ts, *.schemas.ts, *.test.tsx
```

O `main.tsx` só chama `App`. A página do painel (`/`) fica em `app/pages/` porque reúne componentes de três módulos.

## 4. Módulos

Cada módulo tem uma responsabilidade única e expõe no `index.ts` só o que as outras partes precisam: a página ou os componentes públicos. Nenhum módulo depende de outro.

| Módulo | Responsabilidade | Onde aparece | Endpoints consumidos | Exporta |
| --- | --- | --- | --- | --- |
| `auth` | Login, logout, sessão atual e proteção das rotas privadas | `/login` | `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` | `LoginPage`, `useSession`, `RequireAuth`, `useLogout` |
| `status` | Situação atual do dispositivo | Painel (`/`) | `GET /api/status` | `StatusCard` |
| `readings` | Gráfico de temperatura por período | Painel (`/`) | `GET /api/readings` | `ReadingsChart` |
| `events` | Lista de eventos com filtro por tipo | Painel (`/`) | `GET /api/events` | `EventsList` |
| `reports` | Resumo diário e download do CSV | `/relatorios` | `GET /api/reports/daily` | `ReportsPage` |

O `app/` registra as rotas: `/login` (`LoginPage`), `/` (`PainelPage`, que reúne `StatusCard`, `ReadingsChart` e `EventsList`) e `/relatorios` (`ReportsPage`). As duas últimas ficam atrás do `RequireAuth`.

## 5. Camadas dentro de um módulo e regras de dependência

Os dados descem sempre na mesma ordem: página, componentes, hooks, api e cliente HTTP. Cada camada só chama a seguinte.

| Camada | Arquivo | Faz | Não faz |
| --- | --- | --- | --- |
| Página | `*.page.tsx` | Monta a tela ou o bloco de tela do módulo (por exemplo, o StatusCard) com componentes e hooks e define os estados de carregamento, erro e vazio | Chamar a API; formatar dados |
| Componentes | `components/*.tsx` | Desenham a interface a partir de props | Chamar a API; conhecer rotas; usar o TanStack Query |
| Hooks | `*.hooks.ts` | Consultas e mutações do TanStack Query, com as chaves de cache; preparam os dados para a tela | Desenhar interface; usar `fetch` |
| Api | `*.api.ts` | Chama o cliente HTTP e valida a resposta com o schema | Importar React |
| Schemas | `*.schemas.ts` | Schemas zod e tipos do contrato da API | Lógica |

Regras de dependência, verificadas no CI pelo dependency-cruiser (o build falha se alguma for quebrada):

1. Nenhum módulo importa outro módulo.
2. O `app/` importa os módulos somente pelo `index.ts` deles.
3. `shared/` e `config/` não importam de `modules/` nem de `app/`.
4. Só o `shared/api/http.ts` usa `fetch`; os arquivos `*.api.ts` usam esse cliente.
5. Componentes não importam `*.api.ts` nem `@tanstack/react-query`; só os hooks fazem isso.
6. Não há ciclos de importação.

## 6. Código compartilhado

O `shared/` e o `config/` reúnem o que todos os módulos usam e não têm regra de negócio.

| Arquivo | O que oferece |
| --- | --- |
| `config/env.ts` | Lê `import.meta.env`, valida com zod e exporta `env.apiUrl` e `env.deviceId`; se faltar variável, o painel mostra uma tela de erro de configuração |
| `shared/api/http.ts` | Função `http(caminho, opções, schema)`: usa `env.apiUrl` como base, envia `credentials: "include"`, trata JSON, aplica timeout de 15 s, valida a resposta com o schema e lança `ApiError` em qualquer falha |
| `shared/api/errors.ts` | Classe `ApiError` com `status`, `code`, `message` e `details`, no formato de erro da API |
| `shared/ui/` | Componentes visuais sem regra de negócio: `Button`, `Card`, `Field`, `Spinner`, `ErrorState`, `EmptyState`, `StatusBadge` e `PageHeader` |
| `shared/format/date.ts` | `formatDateTime`, `formatTime` e `toSaoPauloDay`, sempre em pt-BR e America/Sao\_Paulo; converte o ISO 8601 UTC da API só aqui |
| `shared/format/number.ts` | `formatTemp` ("27,4 °C") e `formatPct` ("62 %") |
| `shared/test/` | Servidor MSW com respostas padrão da API e `render` com os provedores |

## 7. Telas e comportamento

| Tela | Conteúdo | Regras |
| --- | --- | --- |
| Login (`/login`) | Campos e-mail e senha e botão Entrar | Erro 401: "E-mail ou senha inválidos"; erro 429: "Muitas tentativas. Tente de novo em 15 minutos."; falha de rede: "Sem conexão com o servidor". Após o login, volta à rota de origem ou a `/` |
| Painel — status (`/`) | Temperatura, umidade, ventilador (ligado ou desligado), última comunicação e versão do firmware | O selo mostra **Normal** abaixo de 30 °C, **Atenção** a partir de 30 °C, **Crítico** a partir de 35 °C e **Sem comunicação** quando `lastSeenAt` tem mais de 30 min. Um aviso fixo informa que os dados chegam em lotes de 15 min |
| Painel — gráfico (`/`) | Temperatura mínima, média e máxima no período, com linhas de referência em 30 °C e 35 °C | O seletor de período define a agregação: 6 h com `1m`, 24 h (padrão) com `5m`, 7 dias com `15m` e 30 dias com `1h`, sempre abaixo do limite de 1.000 pontos da API. Eixo de horas em America/Sao\_Paulo |
| Painel — eventos (`/`) | Lista dos eventos do dispositivo, do mais novo para o mais antigo | Filtro opcional por tipo. Mostra 50 itens e o botão Ver mais sobe o limite até 200. Os rótulos em português dos 7 tipos (fan\_on: Ventilador ligado; fan\_off: Ventilador desligado; temp\_critical: Temperatura crítica; sensor\_failure: Falha no sensor; sensor\_recovered: Sensor recuperado; boot: Dispositivo reiniciado; connectivity\_restored: Conexão restabelecida) ficam em `events/event-labels.ts`; tipo sem rótulo aparece com o próprio código |
| Relatórios (`/relatorios`) | Seletor de dia (padrão: ontem), resumo com temperatura mínima, máxima e média, minutos de ventilador e número de leituras, e o botão Baixar CSV | O dia é o do fuso America/Sao\_Paulo. O CSV é um link para `GET /api/reports/daily` com `format=csv`. Resposta 404 mostra "Sem resumo para este dia" |

Comportamento comum a todas as telas:

- Toda consulta tem três estados visuais: carregando (`Spinner` com texto), erro (mensagem e botão "Tentar de novo") e vazio (`EmptyState`).
- As consultas do painel atualizam a cada 60 s e param quando a aba está oculta. O `staleTime` é de 30 s. Não há nova tentativa em erros 4xx; em erros 5xx e de rede há até 2 tentativas.
- Datas e horas em pt-BR, no fuso America/Sao\_Paulo; temperatura com uma casa decimal e vírgula.
- Campos com rótulo associado, foco visível e navegação completa por teclado.
- O estado do painel nunca depende só da cor: o selo traz sempre o texto (Normal, Atenção, Crítico ou Sem comunicação).
- O gráfico tem um texto alternativo (`aria-label`) com a temperatura mínima, média e máxima do período.

## 8. Integração com a API

O front consome somente os endpoints do contrato da API (seção 7 do documento do back-end). Os schemas zod de cada módulo espelham esse contrato; uma resposta fora do formato é tratada como falha de servidor e registrada no console em desenvolvimento.

| Hook | Endpoint | Parâmetros | Atualização |
| --- | --- | --- | --- |
| `useSession` | `GET /api/auth/me` | — | Ao iniciar o painel |
| `useLogin` (mutação) | `POST /api/auth/login` | `email`, `password` | — |
| `useLogout` (mutação) | `POST /api/auth/logout` | — | — |
| `useStatus` | `GET /api/status` | `deviceId` | A cada 60 s |
| `useReadings` | `GET /api/readings` | `deviceId`, `from`, `to`, `bucket` | A cada 60 s |
| `useEvents` | `GET /api/events` | `deviceId`, `from`, `to`, `type`, `limit` | A cada 60 s |
| `useDailyReport` | `GET /api/reports/daily` | `deviceId`, `day`, `format=json` | Sob demanda |

Chaves de cache do TanStack Query: `['session']`, `['status', deviceId]`, `['readings', deviceId, from, to, bucket]`, `['events', deviceId, from, to, type, limit]` e `['report', deviceId, day]`.

Sessão e erros:

- Ao iniciar, o painel chama `GET /api/auth/me`: 200 libera as rotas privadas; 401 leva a `/login`.
- Qualquer resposta 401 depois disso (sessão vencida, de 7 dias) limpa o cache do TanStack Query e redireciona para `/login?next=<rota atual>`.
- O logout chama `POST /api/auth/logout`, limpa o cache e vai para `/login`.
- Toda falha chega aos hooks como `ApiError`, com o `code` do formato de erro da API. Erro 429 mostra a mensagem da tela; 404 vira estado vazio onde a tela prevê; 5xx e falha de rede mostram o estado de erro com "Tentar de novo".
- O `deviceId` vem de `env.deviceId` e é passado a todos os hooks de dados.

## 9. Segurança e configuração

- O front não guarda token, chave ou senha: a sessão é o cookie `httpOnly` da API. Nada de credencial vai para `localStorage` nem `sessionStorage`.
- Todas as requisições usam `credentials: "include"`.
- O painel e a API ficam em subdomínios do mesmo domínio, para que o cookie `sameSite=lax` da API seja enviado: `app.` e `api.` em produção; `app-staging.` e `api-staging.` no staging. A API aceita CORS, com cookies, somente da origem do painel (`WEB_ORIGIN`).
- A regra `react/no-danger` do ESLint está como erro: é proibido usar `dangerouslySetInnerHTML`.
- Respostas da API só chegam à tela depois de validadas pelo schema zod.
- O `web/vercel.json` envia os cabeçalhos `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` e `X-Frame-Options: DENY`.
- Variáveis com prefixo `VITE_` vão para o código do navegador e são públicas: nenhum segredo pode ter esse prefixo.

| Variável | Uso |
| --- | --- |
| `VITE_API_URL` | Endereço base da API do ambiente, incluindo `/api` (por exemplo, `https://api.<domínio>/api`) |
| `VITE_DEVICE_ID` | Identificador do dispositivo consultado pelo painel (`devices.id`) |

As variáveis são validadas na inicialização por `config/env.ts`; no desenvolvimento ficam em `web/.env.local`, fora do Git, e nos outros ambientes são configuradas na Vercel.

## 10. Testes e qualidade

| Tipo de teste | O que cobre | Ferramenta |
| --- | --- | --- |
| Unitário | Formatação de datas e números, schemas, regra do selo de status (30 °C, 35 °C e 30 min sem comunicação) e mapa de período para agregação | Vitest |
| Componentes e telas | Cada tela nos estados carregando, sucesso, erro e vazio, com a API simulada pelo MSW | Vitest, Testing Library e MSW |
| Fluxo de sessão | Login com sucesso e com erro 401 e 429, redirecionamento por 401 e logout | Vitest, Testing Library e MSW |

A cobertura mínima é de 80 % nos arquivos `*.hooks.ts`, `*.schemas.ts` e `shared/format/**`.

Padrões verificados pelas ferramentas:

- TypeScript com `strict` e `noUncheckedIndexedAccess`, sem `any` explícito.
- ESLint com as regras recomendadas de TypeScript, React, hooks e jsx-a11y, e `react/no-danger` como erro. Qualquer aviso falha a verificação.
- Prettier como único formatador.
- dependency-cruiser com as regras da seção 5.

Scripts do `web/package.json`: `dev`, `build`, `preview`, `lint`, `format:check`, `typecheck`, `depcruise` e `test`.

## 11. Integração e entrega contínuas

Branches, regras de merge, ambientes, segredos e workflows de deploy estão no documento "Repositório e pipelines". Esta seção define o job `web` do workflow `ci` e a configuração da Vercel do front-end. O workflow `ci` roda os jobs `api` e `web` em todo pull request, e o merge só é liberado com ambos verdes.

Passos do job `web`, na ordem. O primeiro que falhar bloqueia o merge:

| Passo | Comando | Falha quando |
| --- | --- | --- |
| 1. Instalação | `pnpm install --frozen-lockfile` | O lockfile não bate com o `package.json` |
| 2. ESLint | `pnpm lint` | Há qualquer erro ou aviso |
| 3. Prettier | `pnpm format:check` | Algum arquivo está fora do padrão |
| 4. Tipos | `pnpm typecheck` (`tsc --noEmit`) | Há erro de tipo |
| 5. Fronteiras | `pnpm depcruise` | Uma regra de dependência da seção 5 é quebrada |
| 6. Testes | `pnpm test --coverage` | Um teste falha ou a cobertura fica abaixo de 80 % nos arquivos da seção 10 |
| 7. Build | `pnpm build` | O código não compila ou as variáveis de ambiente não passam na validação |

Configuração do projeto na Vercel:

- O front é um projeto da Vercel separado do da API, com `web/` como diretório raiz. A integração automática com o Git fica desligada; a publicação é feita pelos workflows de deploy.
- A variável `VITE_API_URL` aponta para a API do ambiente: `https://api-staging.<domínio>/api` no staging e `https://api.<domínio>/api` em produção. O front fica em `app-staging.` e `app.`, respectivamente.
- O `web/vercel.json` redireciona todas as rotas para `/index.html`, para que as rotas do React Router funcionem ao recarregar a página, e define os cabeçalhos da seção 9:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "X-Frame-Options", "value": "DENY" }
      ]
    }
  ]
}
```
