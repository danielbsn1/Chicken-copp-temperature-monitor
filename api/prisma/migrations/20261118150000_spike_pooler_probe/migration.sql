-- SPIKE (descartável): tabela só para provar INSERT/SELECT e createMany pelo pooler.
-- Sai numa migração nova quando a spike terminar; esta nunca é editada.
CREATE TABLE "pooler_probe" (
  "id" SERIAL NOT NULL,
  "nonce" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "pooler_probe_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "pooler_probe_nonce_key" ON "pooler_probe"("nonce");
