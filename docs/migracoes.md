# Migrações do banco

A Vercel publica a API e o painel pela integração Git, mas não aplica migrações. Por enquanto elas são aplicadas à mão, uma vez por ambiente e só quando há migração nova, por quem tem a senha do papel `avitech_migrator`. Um workflow `migrate.yml` (merge em `development` migra o staging; merge em `main`, depois da aprovação do environment `production`, migra a produção) fica para quando mais de uma pessoa mexer no banco ou as migrações ficarem frequentes.

## Ordem

1. Migração mergeada em `development`: aplicar no **staging**.
2. Conferir que `GET /api/health` do staging responde 200.
3. Só então, com o mesmo código em `main`, aplicar na **produção**.

## Comando

Use a conexão do Session pooler do ambiente (porta 5432, usuário `avitech_migrator.<referência>`, ver `docs/supabase.md`). A `DIRECT_URL` é digitada no terminal sem eco: não vai para o histórico do shell, para `.env` nem para log.

Linux/macOS (bash/zsh):

```bash
cd api
read -rsp "DIRECT_URL: " DIRECT_URL && export DIRECT_URL && echo
pnpm db:deploy
unset DIRECT_URL
```

PowerShell 7+:

```powershell
cd api
$env:DIRECT_URL = Read-Host "DIRECT_URL" -MaskInput
pnpm db:deploy
Remove-Item Env:DIRECT_URL
```

O log mostra cada migração aplicada (`Applying migration ...`) e termina com `All migrations have been successfully applied`. Se uma migração é inválida, o comando falha com a mensagem do Prisma e o código de saída ≠ 0; o Prisma não imprime a conexão. Nada novo é aplicado até corrigir (`prisma migrate resolve`).

## Regra: migrações compatíveis com o código anterior

A Vercel pode publicar o código antes ou depois da migração, então durante alguns minutos o código antigo roda no banco novo, ou o código novo no banco antigo. Por isso toda migração precisa funcionar com o código da versão anterior: primeiro adicionar, depois remover.

- **Coluna nova:** nullable ou com `DEFAULT`; nunca `NOT NULL` sem default.
- **Remover ou renomear coluna, tabela ou índice usado:** em duas etapas. Primeiro um deploy do código que deixa de usar, depois, em outra migração, a remoção.
- **Renomear:** criar a nova, copiar os dados, trocar o código, remover a antiga (migrações e deploys separados).
- **Endurecer restrição (`NOT NULL`, CHECK, FK):** só depois de o código parar de gravar valores que a violam e de os dados existentes estarem corrigidos.
- **Migração já aplicada nunca é editada:** correções entram como migração nova.
