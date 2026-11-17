-- Papéis do banco (ver docs/supabase.md).
-- As senhas NÃO ficam aqui: nos projetos do Supabase os papéis são criados à mão
-- no SQL Editor, com senha própria. Este arquivo só garante o mesmo desenho num
-- Postgres descartável (CI, máquina local) e as permissões sobre as tabelas.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'avitech_app') THEN
    CREATE ROLE avitech_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END
$$;

-- A API só lê e escreve dados; nunca altera a estrutura.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO avitech_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO avitech_app;

-- Tabelas criadas por migrações futuras (por quem roda a migração) herdam o mesmo acesso.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO avitech_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO avitech_app;
