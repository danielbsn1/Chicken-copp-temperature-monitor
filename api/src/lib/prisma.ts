import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { env } from "./env.js";

let client: PrismaClient | undefined;

export function prisma(): PrismaClient {
  client ??= new PrismaClient({
    adapter: new PrismaPg({ connectionString: env("DATABASE_URL") }),
  });
  return client;
}

export type Db = Pick<PrismaClient, "device" | "reading" | "event">;
