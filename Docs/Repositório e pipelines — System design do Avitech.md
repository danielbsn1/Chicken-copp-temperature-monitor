&#91;image: Logo Avitech\]

# Repositório e pipelines — System design do Avitech

Nov 14, 2026 · @Daniel

Este documento define o repositório do Avitech no GitHub e as pipelines de integração e entrega: a estrutura de pastas, as branches, as proteções, os ambientes, os segredos e o que cada workflow deve fazer. A equipe implementa os workflows e configura o repositório exatamente como descrito aqui, antes de começar o código das aplicações.

## 1. Repositório

O Avitech usa um único repositório, `Chicken-copp-temperature-monitor`, com uma pasta por aplicação e os arquivos comuns na raiz.

```
Chicken-copp-temperature-monitor/
  .github/
    workflows/
      ci.yml
      deploy-staging.yml
      deploy-production.yml
      backup.yml
    dependabot.yml
    pull_request_template.md
    CODEOWNERS
  api/                    # back-end (documento do back-end)
  web/                    # front-end (documento do front-end)
  firmware/               # ESP32
  docker-compose.yml      # Postgres 16 local, porta 5433
  .editorconfig
  .gitignore
  README.md
```

Arquivos obrigatórios na raiz e em cada aplicação:

| Arquivo | Onde | Conteúdo |
| --- | --- | --- |
| `README.md` | Raiz | O que é o Avitech, o mapa das pastas, como subir o ambiente local e o fluxo de branches |
| `.gitignore` | Raiz | `node_modules`, `dist`, `coverage`, `.env*` (exceto `.env.example`), `secrets.h` e arquivos de editor |
| `.editorconfig` | Raiz | UTF-8, fim de linha LF, indentação de 2 espaços e nova linha no fim do arquivo |
| `docker-compose.yml` | Raiz | Serviço Postgres 16 na porta 5433 com volume nomeado, para o desenvolvimento local |
| `.env.example` | `api/` e `web/` | Todas as variáveis da aplicação, sem valores reais, com um comentário de uma linha em cada |
| `package.json` | `api/` e `web/` | Os scripts definidos nos documentos de cada aplicação, e `engines` com Node 22 |
| `pnpm-lock.yaml` | `api/` e `web/` | Versionado; o CI instala com `--frozen-lockfile` |

Nenhum segredo, chave ou senha entra no Git. O que for sensível fica nos GitHub Environments (seção 4) e, localmente, em arquivos `.env.local` ignorados.

## 2. Branches e merge

| Branch | Papel | Recebe de | Tipo de merge |
| --- | --- | --- | --- |
| `main` | Produção; cada merge publica | `development` | Merge commit |
| `development` | Integração; cada merge publica no staging | `feat/*` e `fix/*` | Squash |
| `feat/<módulo>` e `fix/<assunto>` | Uma alteração por branch (exemplos: `feat/auth`, `fix/ingest-timestamp`), criada a partir de `development` | — | Apagada após o merge |

Regras do fluxo:

- Ninguém faz push direto em `main` nem em `development`; toda alteração entra por pull request.
- O título do pull request segue o formato `tipo(escopo): descrição`, com tipo `feat`, `fix`, `refactor`, `test`, `docs`, `ci` ou `chore`, porque o squash usa o título como mensagem do commit. Exemplo: `feat(auth): login com cookie de sessão`.
- O pull request de `development` para `main` leva o título `release: AAAA-MM-DD`.
- Uma branch `feat/*` só é aberta a partir da última `development` e não vive mais que uma funcionalidade.

## 3. Configuração do GitHub

O repositório é `danielbsn1/Chicken-copp-temperature-monitor`, com `main` como branch padrão. Como o repositório é público, nada que seja segredo entra no Git: chaves, senhas, URLs de banco e tokens ficam somente nos Environments (seção 4).

| Item | Configuração |
| --- | --- |
| Ruleset `Proteção main` | Ativo. Bloqueia exclusão e force push; exige pull request com 1 aprovação, revisão invalidada a cada novo push e conversas resolvidas; só permite merge commit; exige o check `ci` atualizado com a branch |
| Ruleset `Proteção development` | Ativo. Mesmas regras, mas só permite squash |
| Merge | Squash e merge commit habilitados; rebase desabilitado |
| Branches | Apagar a branch automaticamente após o merge |
| Environments | `staging` e `production` |
| Check obrigatório | Um único status chamado `ci`, produzido pelo job agregador do workflow `ci` (seção 5) |
| Dependabot | Atualizações semanais de `api`, `web` e das actions |
| Secret scanning e push protection | Habilitados |

O status `ci` precisa ter rodado ao menos uma vez para aparecer na lista de checks; por isso o primeiro pull request da estrutura inicial (seção 8) é o que cria o workflow.

## 4. Ambientes e segredos

Cada Environment tem seus próprios segredos. O ambiente `production` exige aprovação manual do responsável antes de o job de deploy iniciar; o `staging` não exige.

| Secret | Environment | Uso |
| --- | --- | --- |
| `VERCEL_TOKEN` | `staging`, `production` | Autentica a CLI da Vercel nos deploys |
| `VERCEL_ORG_ID` | `staging`, `production` | Conta/time da Vercel |
| `VERCEL_PROJECT_ID_API` | `staging`, `production` | Projeto Vercel da API do ambiente |
| `VERCEL_PROJECT_ID_WEB` | `staging`, `production` | Projeto Vercel do front-end do ambiente |
| `DIRECT_URL` | `staging`, `production` | Conexão direta ao Postgres do ambiente, usada só por `db:deploy` |
| `BACKUP_DATABASE_URL` | `production` | Conexão de leitura usada pelo workflow de backup |
| `BACKUP_STORAGE_KEY` | `production` | Credencial de escrita no armazenamento externo dos backups |

Os valores de `DATABASE_URL`, `CRON_SECRET`, `SESSION_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` e `WEB_ORIGIN` ficam nas variáveis de ambiente dos projetos da Vercel, conforme o documento do back-end, e não nos workflows.

Regras:

- Os workflows de deploy declaram `environment: staging` ou `environment: production`; nenhum secret é definido no nível do repositório.
- Nenhum workflow imprime secrets nem os repassa a pull requests vindos de forks.
- Cada ambiente usa seu próprio projeto Supabase e seus próprios projetos Vercel; staging e produção não compartilham credenciais.

## 5. Workflows

Os passos de cada job de verificação estão nas seções 11 dos documentos do back-end (job `api`) e do front-end (job `web`). Este documento define os arquivos, os gatilhos e a ordem.

| Arquivo | Gatilho | Função |
| --- | --- | --- |
| `ci.yml` | `pull_request` para `development` e `main` | Roda os jobs `api` e `web` em paralelo e o job agregador `ci` |
| `deploy-staging.yml` | `push` em `development` | Aplica migrations no banco de staging e publica `api` e `web` no staging |
| `deploy-production.yml` | `push` em `main` | Aplica migrations no banco de produção e publica `api` e `web` em produção |
| `backup.yml` | Agendado diário e `workflow_dispatch` | Gera `pg_dump` do banco de produção e grava no armazenamento externo |
| `dependabot.yml` | Semanal | Abre pull requests de atualização para `api`, `web` e GitHub Actions |

**`ci.yml`**

- Job `api`: executa os passos do documento do back-end, com serviço Postgres 16 para o `db:deploy` e os testes.
- Job `web`: executa os passos do documento do front-end.
- Job `ci`: depende de `api` e `web` com `if: always()` e falha se qualquer um deles não terminar com sucesso. É o único check exigido pelos rulesets.

**Deploy (staging e produção)**

1. Instalar dependências com lockfile congelado.
2. Executar `db:deploy` na API usando `DIRECT_URL` do Environment.
3. Publicar a API com `vercel deploy` (com `--prod` em `main`).
4. Publicar o front-end da mesma forma.
5. Chamar `GET /api/health` do ambiente publicado; o job falha se a resposta não for 200.

Quando uma alteração muda o contrato da API, a API é publicada antes do front-end. Se `db:deploy` falhar, nada é publicado.

**`backup.yml`**

- Roda diariamente às 07:00 UTC, antes do envio do relatório diário.
- Gera o dump com `pg_dump` usando `BACKUP_DATABASE_URL`, comprime e envia ao armazenamento externo com `BACKUP_STORAGE_KEY`.
- O dump nunca é salvo como artifact do workflow nem commitado, porque o repositório é público.
- Mantém os últimos 30 dias de dumps no armazenamento e remove os mais antigos.
- Falha do job notifica o responsável pelo repositório.

## 6. Padrões dos workflows

Todos os arquivos em `.github/workflows/` seguem estas regras:

- Runner `ubuntu-latest`, Node.js 22 e pnpm, instalados com `actions/setup-node` e cache do gerenciador de pacotes.
- `permissions: contents: read` no topo de cada workflow; permissões adicionais só no job que precisa.
- Actions de terceiros fixadas por versão completa; o Dependabot mantém as versões atualizadas.
- `timeout-minutes` em todos os jobs (10 nos de verificação, 15 nos de deploy).
- `concurrency` por branch no `ci.yml`, cancelando execuções antigas; nos deploys, `cancel-in-progress: false` para nunca interromper uma publicação em andamento.
- Jobs de deploy usam `environment` e não rodam em pull requests.
- Nenhum passo imprime secrets, variáveis de conexão ou conteúdo de `.env`.
- O `ci.yml` não acessa secrets; os testes usam o Postgres do serviço do próprio job.
- Cada passo tem `name` descritivo, e os comandos são os scripts do `package.json` (`lint`, `format:check`, `typecheck`, `depcruise`, `test`, `build`), de modo que o mesmo comando roda local e na pipeline.

## 7. Modelos e convenções

**`.github/pull_request_template.md`** contém as seções:

- O que mudou e por quê.
- Como testar.
- Checklist: `lint`, `format:check`, `typecheck`, `depcruise` e testes executados localmente; migrations incluídas quando há mudança de schema; documentação atualizada quando há mudança de contrato.

**`.github/CODEOWNERS`**

| Caminho | Responsável |
| --- | --- |
| `*` | `@danielbsn1` |
| `/.github/` | `@danielbsn1` |
| `/api/prisma/` | `@danielbsn1` |

**Convenções**

- Mensagens de commit e títulos de pull request seguem `tipo(escopo): descrição`, conforme a seção 2.
- Arquivos `.env.example` em `api/` e `web/` listam todas as variáveis com valores fictícios; arquivos `.env` reais são ignorados pelo Git.
- `.editorconfig` na raiz: UTF-8, LF, indentação de 2 espaços, newline final.
- O `README.md` da raiz descreve o sistema, como subir o ambiente local com `docker-compose.yml` e como rodar os scripts de cada app.

## 8. Critérios de aceite

A entrega do repositório e das pipelines está concluída quando:

1. O primeiro pull request (`feat/scaffold` para `development`) contém `api/` e `web/` mínimos (cada um com `lint`, `format:check`, `typecheck`, `depcruise`, `test` e `build` passando), `.github/` completo e `.editorconfig`.
2. O check `ci` aparece no pull request, roda `api` e `web` e fica verde; um erro proposital de lint ou de teste torna o `ci` vermelho e bloqueia o merge.
3. Não é possível fazer push direto em `main` nem em `development`, nem fazer merge sem aprovação e sem o `ci` verde.
4. O merge em `development` publica API e front-end no staging, e `GET /api/health` do staging responde 200.
5. O merge de `development` em `main` aguarda a aprovação do Environment `production` e publica em produção com `GET /api/health` respondendo 200.
6. Uma migration inválida interrompe o deploy sem publicar nada.
7. O `backup.yml` executado manualmente grava um dump no armazenamento externo, e nenhum dump aparece em artifacts nem no Git.
8. Os secrets da seção 4 existem nos Environments corretos e não aparecem em nenhum log.
9. O Dependabot abre ao menos um pull request de teste para `api`, `web` ou actions.
