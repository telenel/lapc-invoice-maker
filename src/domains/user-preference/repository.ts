import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export function findByUserAndKey(userId: string, key: string) {
  return prisma.userPreference.findUnique({
    where: {
      userId_key: { userId, key },
    },
  });
}

export function upsert(
  userId: string,
  key: string,
  value: Prisma.InputJsonValue,
) {
  return prisma.userPreference.upsert({
    where: {
      userId_key: { userId, key },
    },
    create: {
      userId,
      key,
      value,
    },
    update: {
      value,
    },
  });
}

export function deleteByUserAndKey(userId: string, key: string) {
  return prisma.userPreference.deleteMany({
    where: { userId, key },
  });
}
