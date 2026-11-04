-- CreateTable
CREATE TABLE "devices" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "last_seen_at" TIMESTAMPTZ(3),
    "fw_version" TEXT,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "readings" (
    "device_id" TEXT NOT NULL,
    "ts" TIMESTAMPTZ(3) NOT NULL,
    "temp_c" DOUBLE PRECISION NOT NULL,
    "hum_pct" DOUBLE PRECISION NOT NULL,
    "fan_on" BOOLEAN NOT NULL,

    CONSTRAINT "readings_pkey" PRIMARY KEY ("device_id","ts")
);

-- CreateTable
CREATE TABLE "events" (
    "device_id" TEXT NOT NULL,
    "ts" TIMESTAMPTZ(3) NOT NULL,
    "type" TEXT NOT NULL,
    "detail" JSONB,

    CONSTRAINT "events_pkey" PRIMARY KEY ("device_id","ts","type")
);

-- CreateTable
CREATE TABLE "daily_summary" (
    "device_id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "temp_min" DOUBLE PRECISION,
    "temp_max" DOUBLE PRECISION,
    "temp_avg" DOUBLE PRECISION,
    "fan_minutes" INTEGER NOT NULL,
    "minutes_above_30" INTEGER NOT NULL,
    "event_count" INTEGER NOT NULL,
    "missing_minutes" INTEGER NOT NULL,
    "telegram_sent_at" TIMESTAMPTZ(3),

    CONSTRAINT "daily_summary_pkey" PRIMARY KEY ("device_id","day")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_attempts" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "events_device_id_ts_idx" ON "events"("device_id", "ts" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "login_attempts_key_at_idx" ON "login_attempts"("key", "at");
