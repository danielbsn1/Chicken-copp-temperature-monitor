&#91;image: Logo Avitech\]

# Banco de dados — System design do Avitech

Nov 11, 2026 · @Daniel

O banco é um Postgres no Supabase, acessado somente pela API, que grava os lotes enviados pelo ESP32 sem duplicatas. Este documento define os requisitos, o modelo de dados, a consistência, a segurança e a operação do banco, para que a equipe implemente sem precisar decidir nada além do que está aqui.

## 1. Requisitos e padrões de acesso

O banco recebe poucas escritas (1 amostra por minuto por dispositivo, enviadas em lotes de 15 minutos) e atende leituras do painel e login. O desenho é guiado pelas consultas abaixo.

| Consulta | Origem | Frequência | Tabelas | Observação |
| --- | --- | --- | --- | --- |
| Gravar lote de amostras e eventos | `POST /api/ingest` (ESP32) | 1 lote a cada 15 min por dispositivo, mais envio imediato em evento importante | readings, events, devices | Transação única; duplicados são ignorados; atualiza `last_seen_at` e avisa o Healthchecks |
| Autenticar o dispositivo | `POST /api/ingest` | A cada lote | devices | Compara o hash da chave em tempo constante |
| Login do usuário | `POST /api/auth/login` | Raro | users, login\_attempts | Limite de 5 falhas em 15 min (erro 429) |
| Status atual | `GET /api/status` | A cada atualização do painel | devices, readings | Última leitura e `last_seen_at` |
| Série de leituras (24 h, agregada) | `GET /api/readings` | A cada abertura do painel | readings | Faixa de tempo de um dispositivo |
| Lista de eventos com filtros | `GET /api/events` | A cada abertura do painel | events | Filtro por período e por tipo |
| Resumo diário e CSV | `GET /api/reports/daily` | Sob demanda | daily\_summary | Resumo gravado uma vez e relido depois |
| Job diário | `GET /api/jobs/daily-report` | 1 vez por dia, às 7 h | daily\_summary, readings, events, login\_attempts | Calcula o resumo, envia ao Telegram e faz a limpeza |

## 2. Requisitos não funcionais

O controle do ventilador e os alertas críticos são locais no ESP32, então a nuvem não é crítica para a segurança das aves: ela guarda, mostra e vigia.

| Requisito | Valor | O que significa para o banco |
| --- | --- | --- |
| Amostragem | 1 amostra fechada a cada 60 s; sensor lido a cada 2 s ou mais | Cerca de 1.440 linhas por dia |
| Envio de dados | 1 lote a cada 15 min (15 amostras) e envio imediato em evento importante | Cerca de 96 requisições por dia; o painel atrasa até 15 min |
| Autonomia sem internet | Buffer de 6 h (360 amostras) na flash do ESP32 | Leituras com mais de 6 h de atraso se perdem no ESP32, mesmo a API aceitando até 48 h |
| Banco parado | O ESP32 tenta de novo após 30 s e mantém o buffer | O banco pode ficar fora por minutos sem perda de dados |
| Dispositivo mudo | Alerta após 30 min sem lote, vigiado pelo Healthchecks | A API avisa o Healthchecks a cada lote recebido; não há consulta periódica ao banco |
| Resumo diário | 1 vez por dia, às 7 h (America/Sao\_Paulo); único agendador | Gravar `daily_summary` e enviar ao Telegram |
| Alerta crítico | Direto do ESP32 ao Telegram | Não depende da API nem do banco |
| Perda de dados aceita (RPO) | Até 24 h, no pior caso de perda do banco | Backup diário |
| Tempo de recuperação (RTO) | Até 1 dia | Restauração a partir do backup diário |

## 3. Modelo lógico

O modelo tem duas partes sem ligação entre si: os dados do dispositivo (em torno de `devices`) e o acesso ao painel (`users` e `login_attempts`).

| Entidade | Chave primária | Atributos | Relação |
| --- | --- | --- | --- |
| devices | id | name, key\_hash, last\_seen\_at, fw\_version | Um dispositivo tem muitas leituras, eventos e resumos diários |
| readings | (device\_id, ts) | temp\_c, hum\_pct, fan\_on | Pertence a um dispositivo |
| events | (device\_id, ts, type) | detail (JSON) | Pertence a um dispositivo |
| daily\_summary | (device\_id, day) | temp\_min\_c, temp\_max\_c, temp\_avg\_c, fan\_on\_minutes, readings\_count, telegram\_sent\_at | Pertence a um dispositivo |
| users | id | email (único), password\_hash | Nenhuma por chave |
| login\_attempts | id | key, at | Nenhuma por chave |

A sessão do painel é um cookie assinado de 7 dias, então não existe tabela de sessões. As chaves compostas de `readings` e `events` também são o mecanismo contra duplicatas (seção 6). As relações existem como chaves estrangeiras reais no Postgres, e não só no Prisma.

## 4. Modelo físico

As chaves primárias atendem às consultas principais; só `login_attempts` precisa de um índice extra.

| Tabela.coluna | Tipo | Restrições |
| --- | --- | --- |
| devices.id | text | PK |
| devices.name | text | NOT NULL |
| devices.key\_hash | text (SHA-256 em hexadecimal) | NOT NULL |
| devices.last\_seen\_at | timestamptz | opcional |
| devices.fw\_version | text | opcional |
| readings.device\_id | text | PK, FK para devices.id |
| readings.ts | timestamptz (arredondado ao minuto) | PK |
| readings.temp\_c | real | NOT NULL, CHECK entre -10 e 60 |
| readings.hum\_pct | real | CHECK entre 0 e 100 |
| readings.fan\_on | boolean | NOT NULL |
| events.device\_id, ts | text, timestamptz | PK composta com type, FK para devices.id |
| events.type | text | PK; CHECK em fan\_on, fan\_off, temp\_critical, sensor\_failure, sensor\_recovered, boot, connectivity\_restored |
| events.detail | jsonb | opcional |
| daily\_summary.device\_id, day | text, date | PK composta, FK para devices.id |
| daily\_summary.temp\_min\_c, temp\_max\_c, temp\_avg\_c | real | NOT NULL |
| daily\_summary.fan\_on\_minutes, readings\_count | integer | NOT NULL |
| daily\_summary.telegram\_sent\_at | timestamptz | opcional; marca o envio do resumo |
| users.id | uuid | PK |
| users.email | text (minúsculas) | UNIQUE, NOT NULL |
| users.password\_hash | text | NOT NULL |
| login\_attempts.id | bigint | PK |
| login\_attempts.key | text | NOT NULL |
| login\_attempts.at | timestamptz | NOT NULL |

Índices ligados às consultas:

| Índice | Consulta que atende | Ação |
| --- | --- | --- |
| PK de readings (device\_id, ts) | Série de 24 h e última leitura (status) | Sem índice extra |
| PK de events (device\_id, ts, type) | Lista de eventos por período | Sem índice extra; o filtro por tipo não precisa de índice com \~7 mil linhas por ano |
| UNIQUE em users.email | Login | Sem índice extra |
| (key, at) em login\_attempts | Contar falhas dos últimos 15 min | Criar |

Regras de data: guardar sempre em UTC (`timestamptz`); o `day` de `daily_summary` é o dia em America/Sao\_Paulo, o mesmo fuso do painel, para o relatório bater com o que o produtor vê.

## 5. Consistência, idempotência e concorrência

Reenviar um lote é seguro: a chave primária mais o `skipDuplicates` tornam a gravação idempotente. O que já existe é ignorado e a API informa `accepted`, `duplicates` e `rejected`.

Regras da gravação:

- Amostras, eventos e `last_seen_at` são gravados numa **única transação**: ou entra tudo, ou nada.
- Cada amostra é arredondada ao minuto; `ts` é aceito de até 48 h atrás e 5 min à frente.
- O lote tem no máximo 100 amostras e 100 eventos; o firmware envia até 50 por requisição.
- Item com `ts` fora da janela é descartado e contado em `rejected`; os demais itens do lote são gravados e a API responde 200. Assim um item ruim nunca trava o buffer do ESP32.
- Lote com formato inválido recebe 400 e o firmware o descarta, sem reenviar.
- Duas requisições do mesmo lote ao mesmo tempo não duplicam: a chave primária garante, e o `skipDuplicates` faz o conflito ser ignorado em vez de falhar a transação.
- `last_seen_at` só avança: a atualização usa `GREATEST`, para que um lote antigo que chegue atrasado não o faça voltar.
- O firmware só carimba amostras depois de sincronizar o relógio por NTP, para nunca enviar datas de 1970.
- O resumo diário é gravado com upsert em `(device_id, day)`, e `telegram_sent_at` impede enviar o mesmo resumo duas vezes.

## 6. Segurança

O banco guarda só hashes de segredos, e só a API fala com ele.

- A chave do dispositivo tem 32 bytes aleatórios; o banco guarda só o hash SHA-256 e a comparação é em tempo constante. A chave aparece uma única vez, ao ser criada.
- A senha usa hash scrypt com sal aleatório. O login limita 5 falhas em 15 min e usa um hash falso para não revelar quais e-mails existem.
- A sessão é um cookie `httpOnly`, assinado, de 7 dias, com `secure` em produção.
- Segredos ficam fora do Git (`.env*` e `secrets.h` ignorados); a `DATABASE_URL` existe só como variável de ambiente na Vercel.
- O Supabase é usado só como banco: login e regras ficam na nossa API, sem Supabase Auth.
- A API REST do Supabase fica desativada e o RLS fica ligado, sem políticas, nas seis tabelas; assim nada acessa os dados por esse caminho.
- Há dois papéis no banco: um para a API em produção, com SELECT, INSERT, UPDATE e DELETE nas tabelas, e outro, usado só nas migrações, que pode alterar a estrutura.
- A conexão é sempre cifrada (TLS).
- Trocar a chave do dispositivo: rodar `pnpm device:create` de novo gera outra chave e invalida a anterior.
- O endpoint do job diário exige o segredo `CRON_SECRET`.

## 7. Operação: conexões, migrações, backup e monitoramento

A API roda na Vercel, onde cada requisição pode abrir uma conexão nova; por isso o app usa o pooler do Supabase em modo transação, e as migrações usam a conexão direta.

| Área | Definição |
| --- | --- |
| Conexões | O app usa a URL do pooler (modo transação); as migrações usam a URL direta. O pool é limitado por função serverless. |
| Migrações | Ficam em `api/prisma/migrations`. O CI roda `db:deploy` contra um Postgres 16 descartável e, em produção, `db:deploy` roda antes de publicar a API. Migrações já aplicadas e o `migration_lock.toml` nunca são editados. O Postgres local de desenvolvimento usa Docker na porta 5433. |
| Backup | `pg_dump` diário, pelo workflow backup.yml, para um armazenamento externo ao Supabase e ao GitHub (documento "Repositório e pipelines"). |
| Restauração | Restauração completa testada uma vez, em banco à parte, antes de ir para produção. |
| Monitoramento | Healthchecks como vigia: a API avisa a cada lote recebido e o serviço alerta no Telegram após 30 min sem aviso (período de 15 min mais 15 min de tolerância). O uso de armazenamento do banco também é acompanhado. |
| Limpeza | O job diário apaga `login_attempts` com mais de 7 dias e `readings` com mais de 12 meses. |
| Job diário | `GET /api/jobs/daily-report` às 10:00 UTC (7 h em America/Sao\_Paulo), no único agendador do sistema. |
| Ambientes | Há dois projetos Supabase com o mesmo esquema: produção (branch main) e staging (branch development). A URL do banco de produção existe só no ambiente production. O db:deploy roda em cada banco antes da publicação do seu ambiente (detalhes no documento "Repositório e pipelines"). |
