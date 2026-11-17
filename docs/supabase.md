# Supabase: projetos, papéis e conexões

Configuração dos bancos. Aqui não há valores secretos: URLs, senhas e chaves ficam só nas variáveis da Vercel e nos secrets dos GitHub Environments.

## Projetos

| Ambiente | Projeto | Branch | Região |
| --- | --- | --- | --- |
| Staging | `avitech-staging` (`asjqhysauzumvwardcxp`) | `development` | South America (São Paulo) |
| Produção | `avitech-production` (`dnbduxlyycztyqdsifdl`) | `main` | South America (São Paulo) |

Os dois têm o mesmo esquema e não compartilham credenciais. O Supabase serve só como banco: login e regras ficam na API, sem Supabase Auth. A função da Vercel deve rodar na mesma região (`gru1`, São Paulo).

## API REST

A Data API está desativada nos dois projetos (Integrations › Data API). Nada acessa o banco por HTTP do Supabase; só a nossa API, por conexão Postgres.

## Papéis

| Papel | Onde | Permissões |
| --- | --- | --- |
| `avitech_app` | staging e produção | `SELECT`, `INSERT`, `UPDATE`, `DELETE` nas tabelas e `USAGE`/`SELECT` nas sequências; sem alterar estrutura |
| `avitech_migrator` | staging e produção | `USAGE` e `CREATE` no schema `public`; dono das tabelas; usado só nas migrações |
| `avitech_backup` | só produção | somente `SELECT` (com `BYPASSRLS`, para o `pg_dump` ler as tabelas com RLS); usado pelo workflow de backup |

Todos com `LOGIN` e sem `SUPERUSER`, `CREATEDB`, `CREATEROLE` ou `BYPASSRLS`. Cada papel tem senha própria, gerada aleatoriamente, e a senha nunca aparece no Git.

Como foram criados: no SQL Editor de cada projeto, `CREATE ROLE ... LOGIN PASSWORD '...'`, `GRANT CONNECT`, `GRANT USAGE` (e `CREATE` para o migrador) no schema `public` e `ALTER DEFAULT PRIVILEGES FOR ROLE avitech_migrator` dando DML ao `avitech_app` nas tabelas e sequências futuras. O RLS fica ligado e sem políticas nas seis tabelas (migração `20261118120000_esquema_conforme_o_documento`). Por isso o `avitech_app` precisa de `BYPASSRLS`: no Supabase, rodar uma vez em cada projeto `ALTER ROLE avitech_app BYPASSRLS;` no SQL Editor (a migração só faz isso em Postgres descartável, onde quem migra é superusuário). O Supabase REST/`anon` continua sem acesso.

A migração `20261117190000_papeis_e_permissoes_do_banco` repete o desenho, sem senha, em Postgres descartável e concede o acesso às tabelas já existentes.

## Conexões

| Variável | Usada por | Papel | Conexão |
| --- | --- | --- | --- |
| `DATABASE_URL` | API em execução | `avitech_app` | pooler em modo transação (porta 6543), `?pgbouncer=true` |
| `DIRECT_URL` | migrações (`pnpm db:deploy`) | `avitech_migrator` | conexão direta (porta 5432) |
| `BACKUP_DATABASE_URL` | workflow de backup | `avitech_backup` | só em produção |

No pooler o usuário tem o formato `papel.<referência-do-projeto>`.

A conexão direta do Supabase (`db.<projeto>.supabase.co`) usa IPv6. Se o runner do GitHub não alcançar, usar a URL do pooler em modo sessão (porta 5432) como `DIRECT_URL`.

Toda conexão é cifrada (TLS): em cada projeto, Database › Settings › SSL configuration › *Enforce SSL on incoming connections* ligado, e `sslmode=require` nas URLs.

## Onde ficam as URLs

- Variáveis de ambiente da Vercel (Preview e Production, cada uma com o seu projeto).
- Secrets dos GitHub Environments `staging` e `production`.
- Nunca no Git: o repositório é público. O `api/.env.example` só traz valores do Postgres local.
