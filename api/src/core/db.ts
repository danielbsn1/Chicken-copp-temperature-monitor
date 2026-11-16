import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "../config/env.js";
import { PrismaClient } from "../generated/prisma/client.js";

// Um cliente por processo, criado fora do manipulador. O pool tem no máximo
// 1 conexão por função serverless e usa a URL do pooler do Supabase.
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL, max: 1 });

export const db = new PrismaClient({ adapter });
