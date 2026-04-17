import { PrismaClient } from "@prisma/client";
import { env, isProd } from "../config/env.js";
import { logger } from "./logger.js";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: env.databaseUrl,
      },
    },
    log: isProd() ? ["error", "warn"] : ["query", "error", "warn"],
  });

if (!isProd()) {
  globalForPrisma.prisma = prisma;
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
  logger.info("Prisma disconnected");
}
