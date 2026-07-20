import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * PrismaClient 싱글톤.
 *
 * dev 환경에서는 hot reload 마다 모듈이 새로 평가되므로, globalThis 에 캐싱하지
 * 않으면 커넥션이 계속 쌓여 Neon 커넥션 한도를 넘게 됩니다.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL 환경변수가 설정되지 않았습니다. .env 를 확인하세요.");
  }

  // Prisma 7 부터는 드라이버 어댑터가 필수입니다.
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
