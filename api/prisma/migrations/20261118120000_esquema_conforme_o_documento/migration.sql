-- Alinha o esquema ao documento de banco de dados: tipos, chaves estrangeiras
-- reais, CHECKs e RLS. Não mexe na migração inicial.

-- readings: tipos e limites
ALTER TABLE "readings"
  ALTER COLUMN "temp_c" TYPE REAL,
  ALTER COLUMN "hum_pct" TYPE REAL,
  ADD CONSTRAINT "readings_temp_c_check" CHECK ("temp_c" BETWEEN -10 AND 60),
  ADD CONSTRAINT "readings_hum_pct_check" CHECK ("hum_pct" BETWEEN 0 AND 100),
  ADD CONSTRAINT "readings_ts_minuto_check" CHECK ("ts" = date_trunc('minute', "ts"));

-- events: tipos permitidos; a chave primária já atende às consultas
ALTER TABLE "events"
  ADD CONSTRAINT "events_type_check" CHECK ("type" IN (
    'fan_on', 'fan_off', 'temp_critical', 'sensor_failure',
    'sensor_recovered', 'boot', 'connectivity_restored'
  ));
DROP INDEX "events_device_id_ts_idx";

-- daily_summary: nomes e colunas do documento
ALTER TABLE "daily_summary" RENAME COLUMN "temp_min" TO "temp_min_c";
ALTER TABLE "daily_summary" RENAME COLUMN "temp_max" TO "temp_max_c";
ALTER TABLE "daily_summary" RENAME COLUMN "temp_avg" TO "temp_avg_c";
ALTER TABLE "daily_summary" RENAME COLUMN "fan_minutes" TO "fan_on_minutes";
ALTER TABLE "daily_summary"
  DROP COLUMN "minutes_above_30",
  DROP COLUMN "event_count",
  DROP COLUMN "missing_minutes",
  ADD COLUMN "readings_count" INTEGER NOT NULL DEFAULT 0,
  ALTER COLUMN "temp_min_c" TYPE REAL,
  ALTER COLUMN "temp_max_c" TYPE REAL,
  ALTER COLUMN "temp_avg_c" TYPE REAL,
  ALTER COLUMN "temp_min_c" SET NOT NULL,
  ALTER COLUMN "temp_max_c" SET NOT NULL,
  ALTER COLUMN "temp_avg_c" SET NOT NULL;
ALTER TABLE "daily_summary" ALTER COLUMN "readings_count" DROP DEFAULT;

-- users: id uuid e e-mail sempre em minúsculas
ALTER TABLE "users"
  ALTER COLUMN "id" TYPE UUID USING "id"::uuid,
  ADD CONSTRAINT "users_email_minusculas_check" CHECK ("email" = lower("email"));

-- login_attempts: id bigint com sequência
ALTER TABLE "login_attempts" DROP CONSTRAINT "login_attempts_pkey";
ALTER TABLE "login_attempts" DROP COLUMN "id";
ALTER TABLE "login_attempts"
  ADD COLUMN "id" BIGSERIAL NOT NULL,
  ADD CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id");

-- Chaves estrangeiras reais
ALTER TABLE "readings" ADD CONSTRAINT "readings_device_id_fkey"
  FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "events" ADD CONSTRAINT "events_device_id_fkey"
  FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "daily_summary" ADD CONSTRAINT "daily_summary_device_id_fkey"
  FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS ligado e sem políticas: nada acessa os dados pela API REST do Supabase.
-- A API e as migrações conectam com papéis que passam pelo RLS (dono da tabela
-- e BYPASSRLS), por isso não precisam de políticas.
ALTER TABLE "devices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "readings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "daily_summary" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "login_attempts" ENABLE ROW LEVEL SECURITY;

-- Num Postgres descartável (CI, local) quem migra é superusuário e pode dar
-- BYPASSRLS ao papel da API. No Supabase isso é feito à mão (docs/supabase.md).
DO $$
BEGIN
  IF (SELECT rolsuper FROM pg_roles WHERE rolname = current_user)
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'avitech_app') THEN
    ALTER ROLE avitech_app BYPASSRLS;
  END IF;
END
$$;

-- Tabelas e sequências novas já herdam o acesso do papel da API (migração anterior);
-- a sequência recriada de login_attempts precisa do mesmo acesso.
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO avitech_app;
