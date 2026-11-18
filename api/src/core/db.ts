import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "../config/env.js";
import { PrismaClient } from "../generated/prisma/client.js";
import { SUPABASE_CA } from "./supabase-ca.js";

const host = new URL(env.DATABASE_URL).hostname;

// Um cliente por processo, criado fora do manipulador. O pool tem no máximo
// 1 conexão por função serverless e usa a URL do pooler do Supabase.
// No Supabase a conexão é cifrada e verificada pela CA do projeto; no Postgres local não há TLS.
const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
  max: 1,
  ssl: host.endsWith(".supabase.com") ? { ca: SUPABASE_CA } : undefined,
});

export const db = new PrismaClient({ adapter });
