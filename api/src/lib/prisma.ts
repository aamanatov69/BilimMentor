import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import "dotenv/config";
import { Pool } from "pg";

function getRequiredDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not defined");
  }
  return databaseUrl;
}

const pool = new Pool({ connectionString: getRequiredDatabaseUrl() });
const adapter = new PrismaPg(pool);

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development"? ["warn", "error"]: ["error"],
  });

if (process.env.NODE_ENV!== "production") {
  globalForPrisma.prisma = prisma;
}
