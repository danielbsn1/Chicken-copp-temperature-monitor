-- Dono do equipamento e anúncios de pareamento.

-- Cada equipamento passa a ter um dono (usuário). Os que já existiam ficam com o
-- primeiro usuário cadastrado (a instalação antiga tinha um único produtor).
ALTER TABLE "devices" ADD COLUMN "owner_id" UUID;
UPDATE "devices"
   SET "owner_id" = (SELECT "id" FROM "users" ORDER BY "email" LIMIT 1)
 WHERE "owner_id" IS NULL;
ALTER TABLE "devices"
  ADD CONSTRAINT "devices_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "devices_owner_id_idx" ON "devices"("owner_id");

-- Equipamento novo que se anunciou e espera um dono. `key_hash` é o hash da chave que o
-- próprio ESP32 gerou (a chave em claro nunca é gravada); `ip` é o IP público (IPv6 pelo /64).
CREATE TABLE "pairing_announcements" (
  "serial" TEXT NOT NULL,
  "key_hash" TEXT NOT NULL,
  "fw_version" TEXT NOT NULL,
  "ip" TEXT NOT NULL,
  "announced_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "pairing_until" TIMESTAMPTZ(3),
  "claimed_device_id" TEXT,
  CONSTRAINT "pairing_announcements_pkey" PRIMARY KEY ("serial"),
  CONSTRAINT "pairing_announcements_claimed_device_id_fkey"
    FOREIGN KEY ("claimed_device_id") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "pairing_announcements_ip_idx" ON "pairing_announcements"("ip");
CREATE INDEX "pairing_announcements_announced_at_idx" ON "pairing_announcements"("announced_at");

-- A API só lê e escreve dados (mesmo acesso das outras tabelas).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'avitech_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "pairing_announcements" TO avitech_app;
  END IF;
END
$$;
