import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

function getLivePrismaClient() {
  const cached = globalForPrisma.prisma;

  if (cached && typeof (cached as PrismaClient & { schedule?: unknown }).schedule !== "undefined") {
    return cached;
  }

  const fresh = createPrismaClient();

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = fresh;
  }

  return fresh;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getLivePrismaClient();
    return Reflect.get(client as object, prop, receiver);
  },
});
