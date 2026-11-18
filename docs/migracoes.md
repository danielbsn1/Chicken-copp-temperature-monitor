# Migrações do banco

O workflow `migrate.yml` aplica as migrações (`pnpm db:deploy`) e nada mais: a Vercel publica a API e o painel pela integração Git.

| Evento | Job | Environment | Depois da migração |
|---|---|---|---|
| push em `development` | `migrate staging` | `staging` | `GET /api/health` do staging deve responder 200 |
| push em `main` | `migrate production` | `production` (com aprovação) | `GET /api/health` da produção deve responder 200 |

O secret `DIRECT_URL` existe em cada environment e aponta para o banco do ambiente (usuário `avitech_migrator`, porta 5432). O workflow mascara usuário, senha e host da conexão nos logs, e o `health-check.sh` falha se a API não responder 200 em cerca de 1 minuto.

## Regra: migrações compatíveis com o código anterior

A Vercel pode publicar o código antes ou depois da migração, então durante alguns minutos o código antigo roda no banco novo, ou o código novo no banco antigo. Por isso toda migração precisa funcionar com o código da versão anterior: primeiro adicionar, depois remover.

- **Coluna nova:** nullable ou com `DEFAULT`; nunca `NOT NULL` sem default.
- **Remover ou renomear coluna, tabela ou índice usado:** em duas etapas. Primeiro um deploy do código que deixa de usar, depois, em outra migração, a remoção.
- **Renomear:** criar a nova, copiar os dados, trocar o código, remover a antiga (migrações e deploys separados).
- **Endurecer restrição (`NOT NULL`, CHECK, FK):** só depois de o código parar de gravar valores que a violam e de os dados existentes estarem corrigidos.
- **Migração já aplicada nunca é editada:** correções entram como migração nova.

Se uma migração falha, o job falha com a mensagem do Prisma no log e nada novo é aplicado até corrigir (`prisma migrate resolve`).
