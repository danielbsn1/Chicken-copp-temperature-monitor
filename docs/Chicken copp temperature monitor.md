# Chicken copp temperature monitor

## Visão geral

O sistema mede a temperatura do galinheiro com um ESP32, liga o ventilador sozinho e guarda o histórico em um painel web com gráficos e relatórios. O controle roda dentro do ESP32 e nunca depende de internet, API ou banco: se a nuvem cair, o ventilador continua funcionando e só o histórico fica sem gravar por um tempo (as leituras são reenviadas depois).

Este documento cobre a Etapa 1 (firmware autônomo, que já estava descrito no meu guia) e a Etapa 2 (API, banco, painel React, alertas e relatórios). Cada fase termina com um teste de aceite, e só avanço quando ele passa.

## Decisões tomadas

Escolhi Node.js com TypeScript, Next.js na Vercel e Aurora DSQL na AWS, com o controle do ventilador sempre local no ESP32.

| Tema                   | Decisão                                                                                              | Por quê                                                                                                                                                      |
| ---------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Controle do ventilador | Dentro do ESP32, sem depender da rede                                                                | O risco é o calor, e Wi-Fi e nuvem podem cair                                                                                                                |
| Escopo                 | 1 galinheiro e 1 usuário, com `device_id` no banco                                                   | Simples agora, sem refazer o esquema se crescer                                                                                                              |
| Backend                | Node.js + TypeScript                                                                                 | Mesma linguagem do React, pouco código repetitivo                                                                                                            |
| Front e API            | Next.js na Vercel: React e rotas de API no mesmo projeto                                             | Um deploy só e tipos compartilhados                                                                                                                          |
| Banco                  | Aurora DSQL na AWS, na conta gratuita                                                                | Cota mensal gratuita permanente e SQL (PostgreSQL) para relatórios; o Aurora PostgreSQL não pausa com gravação por minuto e custaria cerca de US$ 44 por mês |
| Acesso ao banco        | Prisma ORM, com SQL puro (`$queryRaw`) nas agregações                                                             | Leve em serverless e com controle das consultas por período; compatibilidade com o DSQL a validar na Fase 2                                                  |
| Transporte do ESP32    | HTTPS POST com JSON, em lote                                                                         | Simples e testável com `curl`                                                                                                                                |
| Tempo real             | Consulta a cada 30 s, sem SSE                                                                        | O dado chega a cada 60 s; evita conexões longas em serverless                                                                                                |
| Tarefas agendadas      | Cron da Vercel (relatório diário) e Healthchecks.io (dispositivo mudo), sem scripts na AWS           | O cron Hobby roda 1 vez ao dia, o que basta para o relatório; o Healthchecks.io avisa quando o ping some, sem precisar de job a cada 5 min                   |
| Alertas                | Telegram: críticos direto do ESP32; "dispositivo mudo" pelo Healthchecks.io; relatório pelo servidor | O alerta crítico não depende da nuvem, e não há aviso duplicado                                                                                              |
| Interface              | Recharts e Tailwind CSS                                                                              | Padrão no ecossistema React                                                                                                                                  |
| Login                  | 1 usuário na tabela `users`, senha com hash, cookie httpOnly                                         | Sem cadastro público                                                                                                                                         |

Decidi não usar scripts na AWS: EventBridge e Lambda saíram do projeto e a AWS fica só com o banco.

## Requisitos e escala

O volume de dados é pequeno: 1 amostra por minuto dá 1.440 linhas por dia e cerca de 525 mil por ano, algo em torno de dezenas de MB. O que pesa no design é a confiabilidade do controle e o custo recorrente, não a escala.

**Funcionais**

- Ler temperatura e umidade e ligar o ventilador a 30 °C ou mais, desligando a 28 °C ou menos.
- Avisar no Telegram quando o ventilador ligar, quando o sensor falhar e quando a temperatura continuar subindo com o ventilador ligado.
- Guardar leituras e eventos no banco, com histórico consultável por período.
- Mostrar painel com temperatura atual, estado do ventilador, gráficos e eventos.
- Gerar relatórios diários e por período: mínima, máxima, média, horas com ventilador ligado e tempo acima de 30 °C.
- Avisar quando o dispositivo parar de enviar dados.

**Não funcionais**

- O ventilador responde com Wi-Fi, API e banco fora do ar.
- Nenhuma amostra se perde numa queda de rede curta: o ESP32 guarda e reenvia.
- Dados no painel com no máximo cerca de 90 s de atraso.
- Alerta de dispositivo mudo em até 10 minutos.
- Acesso ao painel só com login, e ao banco só pela API.
- Custo mensal conhecido e com alerta de gasto (ver Observabilidade, backup e custos).

## Arquitetura geral

O ESP32 decide e aciona o ventilador sozinho; a Vercel recebe, mostra e protege os dados e roda o relatório diário, a AWS guarda o histórico e o Healthchecks.io vigia o dispositivo. A linha tracejada é o caminho do alerta crítico, que não passa pela nuvem.

&#91;embedded content: arquitetura · 4 blocos, 8 conexões numeradas\]

1. ESP32 → API: amostras e eventos por HTTPS (`POST /api/ingest`).
2. ESP32 → Telegram: alertas críticos direto, sem depender da nuvem.
3. Usuário → Painel: navegador ou celular, com login.
4. Painel → API: leituras, eventos e relatórios.
5. API → Aurora DSQL: grava e consulta o histórico.
6. API → Healthchecks.io: ping a cada `ingest` válido.
7. Healthchecks.io → Telegram: aviso de dispositivo mudo e de volta.
8. Cron da Vercel → API: dispara o relatório diário, e a API envia o resumo no Telegram.

O diagrama ainda mostra EventBridge, Lambda e Aurora PostgreSQL e preciso refazê-lo com esta lista.

## Firmware do ESP32

O firmware tem duas tarefas independentes: a de controle decide e aciona o relé, e a de rede só transporta dados. A de controle nunca espera pela rede, e a comunicação entre as duas é uma fila de eventos.

**Tarefa de controle**

- Usa temporização por `millis()`, sem `delay()`, e ativa o watchdog para reiniciar a placa se travar.
- Lê o DHT22 a cada 2 s (limite do sensor), usa a mediana de 3 leituras e descarta valores fora de −10 a 60 °C.
- Regra com histerese: liga a 30 °C ou mais, desliga a 28 °C ou menos e mantém o estado entre os dois valores. Cada estado dura no mínimo 60 s para o relé não trepidar.
- Fail-safe: 3 falhas seguidas do sensor ligam o ventilador e geram o evento `SENSOR_FAULT`. Quando o sensor volta, a regra normal retoma e sai `SENSOR_OK`.
- No boot, o pino do relé recebe o nível inicial antes de virar saída, para o ventilador não dar um pulso. O nível ativo (alto ou baixo) fica em `config.h`.
- Se a primeira leitura válida estiver entre 28 e 30 °C, começa com o ventilador ligado (lado seguro).
- A cada 60 s fecha uma amostra (temperatura, umidade e estado do ventilador) e a coloca na fila. Cada mudança de estado vira um evento.

**Tarefa de rede**

- Conecta no Wi-Fi de 2,4 GHz com reconexão automática e espera crescente entre tentativas (10 s até 5 min).
- Sincroniza a hora por NTP. Sem hora válida, não envia amostras, mas o controle segue normal.
- Guarda as amostras num buffer circular na RAM (por exemplo 360 amostras, 6 horas) e envia em lote de até 50 por `POST`.
- Apaga do buffer só o que a API confirmou com resposta 2xx. Erros 5xx e timeouts repetem; 4xx descarta o lote com um log serial; 401 para de tentar e acende um alerta local.
- Envia o Telegram direto dos alertas críticos: ventilador ligou (no máximo 1 a cada 15 min), sensor com defeito e temperatura de 35 °C ou mais com o ventilador ligado.
- Em cada envio vai também a saúde do dispositivo: força do Wi-Fi, tempo ligado, memória livre e versão do firmware.

**Configuração e segredos**

- `config.h`: pinos, limiares 30/28 e 35, intervalos, tempo mínimo do relé, nível ativo do relé, tamanho do buffer.
- `secrets.h` (no `.gitignore`): Wi-Fi, token e chat ID do Telegram, chave de API do dispositivo e URL da API.
- O TLS valida o certificado com o pacote de certificados raiz do ESP32; não se usa `setInsecure()`.

O buffer na RAM se perde se a placa reiniciar. Guardar o buffer em flash (LittleFS) fica como melhoria opcional, depois que o sistema estiver estável.

## Contrato de dados ESP32 → API

O ESP32 fala com a API por um único endpoint, `POST /api/ingest`, que recebe amostras e eventos no mesmo lote. A chave do dispositivo vai no cabeçalho `X-Device-Key`.

```json
{
  "device_id": "galinheiro-1",
  "fw": "1.0.0",
  "health": { "rssi": -67, "uptime_s": 86400, "free_heap": 182000 },
  "samples": [
    { "ts": 1793270400, "temp_c": 29.4, "hum_pct": 61.2, "fan_on": false }
  ],
  "events": [
    { "ts": 1793270460, "type": "FAN_ON", "detail": { "temp_c": 30.1 } }
  ]
}
```

| Regra                   | Definição                                                                                                              |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Hora                    | `ts` em segundos Unix (UTC), arredondado ao minuto nas amostras                                                        |
| Idempotência            | Chave única `(device_id, ts)` nas amostras e `(device_id, ts, type)` nos eventos; reenviar o mesmo lote não duplica    |
| Tipos de evento         | `BOOT`, `FAN_ON`, `FAN_OFF`, `SENSOR_FAULT`, `SENSOR_OK`, `TEMP_CRITICAL`, `WIFI_RECONNECT`                            |
| Validação               | Até 100 amostras por chamada; `ts` entre 48 h atrás e 5 min à frente; temperatura de −40 a 80 °C; umidade de 0 a 100 % |
| Resposta 200            | `{ "accepted": n, "duplicates": m }`; o ESP32 apaga o lote do buffer                                                   |
| Resposta 400            | Lote malformado; o ESP32 descarta e registra no serial                                                                 |
| Resposta 401            | Chave inválida; o ESP32 para de tentar e sinaliza localmente                                                           |
| Resposta 5xx ou timeout | O ESP32 mantém o lote e tenta de novo com espera crescente                                                             |

A API grava `last_seen` do dispositivo a cada chamada válida, mesmo sem amostras novas. É esse campo que alimenta o alerta de dispositivo mudo.

## Backend (API Node.js na Vercel)

A API é um único projeto Next.js com TypeScript, onde as rotas de API rodam em Node.js e o painel React vive no mesmo repositório. Cada rota valida a entrada com `zod`, usa tipos compartilhados com o front e devolve erros no mesmo formato.

| Endpoint                           | Quem chama     | Autenticação               | Função                                                                                   |
| ---------------------------------- | -------------- | -------------------------- | ---------------------------------------------------------------------------------------- |
| `POST /api/ingest`                 | ESP32          | Chave do dispositivo       | Grava amostras e eventos, atualiza `last_seen`                                           |
| `POST /api/auth/login` e `/logout` | Painel         | Senha                      | Abre e encerra a sessão (cookie httpOnly)                                                |
| `GET /api/status`                  | Painel         | Sessão                     | Última leitura, estado do ventilador, "visto há X min", saúde do dispositivo             |
| `GET /api/readings?from&to&bucket` | Painel         | Sessão                     | Série para gráficos, agregada por 5 min, 1 h ou 1 dia                                    |
| `GET /api/events?from&to`          | Painel         | Sessão                     | Lista de eventos e alertas                                                               |
| `GET /api/reports/daily?date=`     | Painel         | Sessão                     | Resumo do dia; `format=csv` exporta                                                      |
| `GET /api/jobs/daily-report?date=` | Cron da Vercel | `CRON_SECRET` no cabeçalho | Fecha o resumo do dia anterior (ou da data pedida, para reprocessar) e envia no Telegram |

**Organização do código**

- `lib/db`: conexão e consultas; `lib/auth`: sessão e hash de senha; `lib/telegram`: envio de mensagens; `lib/reports`: cálculos do relatório.
- `lib/healthcheck`: ping ao Healthchecks.io depois de responder ao ESP32 (`waitUntil`); se o ping falhar, o `ingest` não falha.
- Datas ficam em UTC no banco e são convertidas para America/Sao_Paulo apenas nos relatórios e na tela.

**Cuidados de serverless**

- Cada chamada é curta e sem estado. O que precisa persistir (resumos diários, limite de tentativas de login) fica no banco.
- Conexão com o banco: o DSQL autentica com token IAM de curta duração, gerado a cada conexão; como a Vercel se autentica na AWS (credenciais de menor privilégio, só para esse cluster) e como o Prisma (com o adaptador `pg`) se comporta com a senha temporária ficam para validar na Fase 2. A camada `server/db` repete a transação em conflito de concorrência otimista.
- Sem SSE nem conexões longas: o painel consulta a cada 30 s.
- Conferir na Fase 2 o ajuste do Fluid compute no painel da Vercel e a conexão com o DSQL antes de escrever o resto da API.

## Banco de dados (AWS)

O banco é o Aurora DSQL, na conta gratuita da AWS. O Aurora PostgreSQL serverless não pausa com gravação a cada minuto e custaria cerca de US$ 44 por mês depois dos créditos; o DSQL tem cota mensal gratuita de 100 mil DPUs e 1 GiB ([AWS Free Tier](https://aws.amazon.com/rds/free/)). O volume do projeto (cerca de 1.440 linhas por dia, em lotes) deve caber nela, e o consumo real de DPUs é medido na Fase 2. Por ser uma conta nova, conferir no console o saldo de créditos e o que acontece quando o plano gratuito acabar.

**Opções consideradas**

| Opção                                          | Pontos fortes                                                  | Pontos fracos                                                                                                                                                                                 | Papel                                                     |
| ---------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Aurora DSQL                                    | Cota mensal gratuita permanente; SQL compatível com PostgreSQL | Compatibilidade parcial e novas tentativas por concorrência otimista ([resumo](https://book.st-hakky.com/en/data-platform/aurora-dsql-overview)); conexão com token IAM; consumo real a medir | Escolha                                                   |
| Aurora PostgreSQL serverless                   | PostgreSQL completo                                            | Não pausa com gravação por minuto; cerca de US$ 44 por mês com 0,5 ACU, estimativa de terceiros ([usage.ai](https://www.usage.ai/blogs/aws/rds/aurora-serverless-v2/))                        | Descartado                                                |
| Postgres gratuito fora da AWS (Neon, Supabase) | PostgreSQL completo e plano gratuito                           | Sai da AWS                                                                                                                                                                                    | Plano B se o DSQL não funcionar com o Prisma ou a Vercel |
| DynamoDB                                       | Pago por uso                                                   | Relatórios por período exigem chaves bem desenhadas e agregação no código                                                                                                                     | Descartado                                                |

**Modelo de dados**

| Tabela           | Colunas principais                                                                                                                              | Observação                                                          |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `devices`        | `id`, `name`, `key_hash`, `last_seen_at`, `fw_version`                                                                                          | Só o hash da chave é guardado                                       |
| `readings`       | `device_id`, `ts`, `temp_c`, `hum_pct`, `fan_on`                                                                                                | Chave primária `(device_id, ts)`                                    |
| `events`         | `device_id`, `ts`, `type`, `detail` (jsonb)                                                                                                     | Chave primária `(device_id, ts, type)`                              |
| `daily_summary`  | `device_id`, `day`, `temp_min`, `temp_max`, `temp_avg`, `fan_minutes`, `minutes_above_30`, `event_count`, `missing_minutes`, `telegram_sent_at` | Gravada pelo job diário; `telegram_sent_at` evita reenviar o resumo |
| `users`          | `id`, `email`, `password_hash`                                                                                                                  | Uma linha                                                           |
| `login_attempts` | `key`, `at`                                                                                                                                     | Limite de tentativas de login                                       |

**Consultas e retenção**

- A chave primária de `readings` já cobre as buscas por período; `events` ganha um índice `(device_id, ts desc)`.
- Os gráficos agregam na hora com `date_trunc` (5 min, 1 h, 1 dia). Um mês são cerca de 43 mil linhas, o que dispensa pré-agregação; gráficos de um ano usam `daily_summary`.
- Como cada amostra vale 1 minuto, `fan_minutes` é a contagem de amostras com `fan_on` e `missing_minutes` é 1.440 menos o total de amostras do dia.
- Dias são calculados no fuso America/Sao_Paulo; o armazenamento é sempre UTC.
- Retenção: guardar tudo. O volume é de dezenas de MB por ano.
- Migrações com `prisma migrate`, versionadas no Git e aplicadas antes de cada deploy. Conferir a lista de recursos que o DSQL não suporta (por exemplo, chaves estrangeiras) antes de escrever o esquema.
- Backup: conferir, ao criar o cluster, a retenção dos backups do DSQL e exportar `daily_summary` em CSV todo mês (opcional).

## Tarefas agendadas e alertas

Sem scripts na AWS. O dispositivo mudo é vigiado pelo Healthchecks.io, e o relatório diário roda no cron da Vercel. O cron do plano Hobby roda no máximo uma vez por dia e com precisão de cerca de uma hora ([Vercel](https://vercel.com/docs/cron-jobs/usage-and-pricing)), o que basta para o relatório e não serve para checar o dispositivo a cada 5 minutos.

| Tarefa           | Frequência                                                 | Como                                                     | Ação                                                                                                  |
| ---------------- | ---------------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Dispositivo mudo | Contínua (período de 5 min e tolerância de 5 min no check) | A API faz ping no Healthchecks.io a cada `ingest` válido | Sem ping por cerca de 10 min, o Healthchecks.io avisa no Telegram e avisa de novo quando o ping volta |
| Relatório diário | Todo dia às 7h de São Paulo (10:00 UTC no `vercel.json`)   | `GET /api/jobs/daily-report`                             | Calcula o dia anterior, grava em `daily_summary` e envia o resumo no Telegram                         |

**Healthchecks.io**

- Um check cujo URL de ping fica como variável sensível (`HC_PING_URL`) na Vercel; o Telegram é configurado como canal de aviso do próprio Healthchecks.io.
- O aviso não distingue ESP32 mudo de API fora do ar (nos dois casos o ping some); o painel e o `last_seen_at` ajudam a separar os casos.
- Não há lembrete a cada 1 h: o aviso sai na queda e na volta.
- Conferir os limites do plano gratuito antes de depender dele.

**Cron da Vercel e segredo**

- O cron fica no `vercel.json`, e a Vercel envia `Authorization: Bearer <CRON_SECRET>`; a API compara em tempo constante.
- O resumo pode chegar entre 7h e 8h por causa da precisão do plano Hobby. Como o job calcula o dia anterior inteiro, o atraso não muda o resultado.
- O job é idempotente: rodar de novo regrava o mesmo `daily_summary` e não reenvia o Telegram se `telegram_sent_at` já estiver preenchido.

**Alertas e regra anti-repetição**

| Alerta                                             | Quem envia                | Regra                              |
| -------------------------------------------------- | ------------------------- | ---------------------------------- |
| Ventilador ligou                                   | ESP32, direto no Telegram | 1 a cada 15 min                    |
| Sensor com defeito e recuperado                    | ESP32                     | Um aviso por mudança de estado     |
| Temperatura de 35 °C ou mais com ventilador ligado | ESP32                     | 1 a cada 30 min enquanto durar     |
| Dispositivo mudo e de volta                        | Healthchecks.io           | Um aviso na queda e outro na volta |
| Resumo diário                                      | Servidor                  | 1 por dia (`telegram_sent_at`)     |

O ESP32 guarda na RAM os carimbos dos alertas que ele envia, e o servidor só envia o resumo diário, então não há mensagem duplicada.

## Frontend React

O painel é pensado primeiro para o celular, porque é de lá que se confere o galinheiro, e tem quatro telas: login, painel, relatórios e eventos. Usa Next.js (React), Tailwind CSS, Recharts para os gráficos e TanStack Query para buscar os dados.

| Tela       | Conteúdo                                                                                                                                                              |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Login      | E-mail e senha; sem cadastro público                                                                                                                                  |
| Painel     | Cartões com temperatura, umidade, estado do ventilador e "visto há X min"; gráfico de 24 h com as faixas de 28 e 30 °C; linha do tempo do ventilador; últimos eventos |
| Relatórios | Filtro por dia, semana ou mês; mínima, máxima, média, horas com ventilador ligado, tempo acima de 30 °C, falhas de dados; exportação em CSV e impressão em PDF        |
| Eventos    | Lista com filtro por tipo e período                                                                                                                                   |

**Comportamento**

- Os dados são atualizados a cada 30 s com `refetchInterval`, e o seletor de período (24 h, 7 dias, 30 dias) escolhe sozinho a agregação de 5 min, 1 h ou 1 dia.
- Estados tratados em toda tela: carregando, sem dados, erro de rede e dispositivo mudo (faixa de aviso no topo quando `last_seen` passar de 10 min).
- Datas exibidas em America/Sao_Paulo, com °C e % sempre indicados nos eixos.
- Cada gráfico mostra lacunas como lacunas (linha interrompida), sem ligar pontos por cima de um período sem dados.
- Acessibilidade básica: contraste, rótulos nos gráficos e o estado do ventilador indicado por texto, não só por cor.

## Segurança

Há quatro pontos a proteger: o dispositivo, o usuário, os jobs e o bot do Telegram. Cada uma tem credencial própria, e nenhuma credencial vai para o Git.

| Entrada               | Proteção                                                                                                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Dispositivo (ESP32)   | Chave de API aleatória e longa no cabeçalho; no banco fica só o hash, comparado em tempo constante. O ESP32 valida o certificado TLS. Para trocar a chave, gera-se outra e regrava-se o firmware |
| Usuário (painel)      | Senha com hash (argon2id ou bcrypt), cookie `httpOnly`, `Secure` e `SameSite=Lax`, limite de tentativas na tabela `login_attempts`, sem cadastro público (o usuário único é criado por script)   |
| Jobs (cron da Vercel) | `CRON_SECRET` no cabeçalho, comparado em tempo constante; endpoint fora de qualquer menu                                                                                                         |
| Telegram              | O bot só aceita comandos do meu chat ID, se um dia ganhar comandos como `/status`                                                                                                                |

**Segredos e infraestrutura**

- Variáveis de ambiente da Vercel marcadas como sensíveis (`CRON_SECRET`, `HC_PING_URL`, credenciais do banco); `secrets.h` no `.gitignore` no firmware.
- Validação de toda entrada com `zod`, limite de tamanho do corpo das requisições e CORS fechado.
- AWS: MFA na conta raiz, uso diário por usuário com permissões mínimas, AWS Budgets com alerta de gasto (ver Observabilidade, backup e custos).
- Conferir, ao criar o cluster DSQL, como a Vercel se autentica (credenciais de menor privilégio, só para esse cluster) e anotar no repositório.
- Os únicos dados pessoais do sistema são o e-mail do login e o chat ID do Telegram.

## Falhas e resiliência

Em toda falha da nuvem, o ventilador continua sendo controlado pelo ESP32. O que muda é se o histórico e os alertas do servidor continuam chegando.

| Falha                                       | O que acontece                                               | Como o design responde                                                                                              |
| ------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Wi-Fi cai                                   | Controle segue; nada é enviado                               | Buffer na RAM (cerca de 6 h) e reenvio em lote com espera crescente                                                 |
| Vercel ou API fora do ar                    | Igual ao Wi-Fi                                               | Mesmo buffer; chaves únicas impedem duplicidade no reenvio                                                          |
| Banco lento ou com conflito de concorrência | A API demora a responder ou repete a transação               | Timeout generoso no ESP32 (cerca de 30 s) e nova tentativa; o lote fica no buffer                                   |
| ESP32 reinicia                              | Perde o buffer da RAM; reavalia o relé pela primeira leitura | Evento `BOOT`; lacuna visível no gráfico e em `missing_minutes`                                                     |
| Falta de energia                            | Nada funciona                                                | O alerta de dispositivo mudo chega pelo servidor                                                                    |
| Sensor falha                                | Leitura inválida                                             | Ventilador ligado (fail-safe) e alerta direto no Telegram                                                           |
| Ventilador ou relé com defeito              | Temperatura sobe mesmo com ventilador ligado                 | Alerta crítico a partir de 35 °C                                                                                    |
| Relógio sem NTP                             | Sem hora confiável                                           | Não envia amostras; a API também rejeita `ts` fora da janela permitida                                              |
| Cron da Vercel falha                        | O resumo do dia não sai                                      | O endpoint aceita `?date=` para reprocessar o dia à mão; um segundo check no Healthchecks.io pode avisar (opcional) |
| Healthchecks.io indisponível                | O aviso de dispositivo mudo não sai                          | O painel mostra a faixa de aviso quando `last_seen` passar de 10 min                                                |
| Telegram indisponível                       | Alerta não sai                                               | O evento fica registrado no banco e aparece na tela de eventos                                                      |

## Observabilidade, backup e custos

Se tudo ficar nas cotas gratuitas, o custo recorrente é zero, mas o banco precisa de um alerta de gasto desde o primeiro dia.

| Item            | Custo ou limite                                                       | Observação                             |
| --------------- | --------------------------------------------------------------------- | -------------------------------------- |
| ESP32 e peças   | R$ 150 a 250 (estimativa do meu guia da Etapa 1)                      | Preços variam por loja                 |
| Vercel Hobby    | Plano gratuito                                                        | O cron roda só o relatório diário      |
| Aurora DSQL     | Cota mensal gratuita de 100 mil DPUs e 1 GiB; conta nova com créditos | Medir o consumo real na Fase 2         |
| Healthchecks.io | Plano gratuito                                                        | Conferir os limites antes de contratar |
| Telegram        | Gratuito                                                              | Bot próprio                            |

**Observabilidade**

- O ESP32 envia a saúde a cada lote (Wi-Fi, tempo ligado, memória livre, versão), e o painel mostra isso na faixa de status.
- Logs da API e do cron ficam nos logs de funções da Vercel. O log do job diário inclui o resultado (por exemplo, "resumo enviado: sim ou não").
- Opcional: um segundo check no Healthchecks.io para o job diário, avisando se o resumo não for enviado.
- AWS Budgets com limite mensal próximo do que aceito pagar e alerta ao chegar a 80 % dele.

**Backup e versionamento**

- Código do firmware, da API e do painel no Git, com uma tag a cada versão do firmware gravada nas placas.
- Um `secrets.example.h` no repositório mostra os campos sem os valores.
- Backup do banco: ver a seção de banco de dados.

## Plano de testes

Cada camada tem testes próprios, e os testes que mais importam são os de falha: eles mostram que o controle independe da nuvem.

| Camada           | O que testar                              | Como                                                                                                                                             |
| ---------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Firmware         | Histerese: liga a 30 °C e desliga a 28 °C | Aquecer o sensor com a mão ou um secador; lógica também no Wokwi                                                                                 |
| Firmware         | Fail-safe do sensor                       | Desconectar o fio de dados: o ventilador liga e o alerta chega                                                                                   |
| Firmware         | Controle sem rede                         | Desligar o roteador por 10 minutos: o relé continua reagindo e as amostras são reenviadas ao voltar, sem lacuna                                  |
| Firmware         | Reinício                                  | Tirar da tomada: o evento `BOOT` chega e o relé reavalia a primeira leitura                                                                      |
| API              | Validação e idempotência do `/api/ingest` | Testes automatizados e `curl`: lote repetido, chave errada, lote com mais de 100 amostras, `ts` fora da janela                                   |
| API              | Agregações e relatórios                   | Testes com dados sintéticos e um dia com lacunas                                                                                                 |
| Banco            | Migrações                                 | Aplicar em um Postgres local em Docker e depois no DSQL, que só é parcialmente compatível; testar também a repetição em conflito de concorrência |
| Jobs e alertas   | Segredo, relatório e dispositivo mudo     | Chamar o job diário com e sem `CRON_SECRET` e repetido (não reenvia); parar o ESP32 por 10 min e conferir o aviso e o de volta no Telegram       |
| Painel           | Telas e estados                           | Testes de componentes e um teste ponta a ponta (login, painel, relatório) com dados falsos                                                       |
| Sistema completo | Precisão e estabilidade                   | 48 h rodando com o ventilador de 12 V, comparando com um termômetro de referência                                                                |

## Roteiro de implementação por fases

São sete fases em sequência, e só se avança quando o teste (gate) da fase atual passa. A Fase 1 já entrega o galinheiro protegido, sem nuvem.

&#91;embedded content: roteiro · 7 fases, cada uma com um gate de teste\]

A Fase 1 segue os marcos do guia da Etapa 1, com duas mudanças: usar `millis()` no lugar de `delay()` a partir do marco 2 e criar a tarefa de rede já no marco do Telegram. Não estimo a duração das fases, porque ela depende do meu ritmo; o gate é o critério de pronto.
