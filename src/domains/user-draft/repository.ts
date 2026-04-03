import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export function findByUserAndRouteKey(userId: string, routeKey: string) {
  return prisma.userDraft.findUnique({
    where: {
      userId_routeKey: { userId, routeKey },
    },
  });
}

export function upsert(
  userId: string,
  routeKey: string,
  data: Prisma.InputJsonValue,
  savedAt: Date,
  expiresAt: Date,
) {
  return prisma.userDraft.upsert({
    where: {
      userId_routeKey: { userId, routeKey },
    },
    create: {
      userId,
      routeKey,
      data,
      savedAt,
      expiresAt,
    },
    update: {
      data,
      savedAt,
      expiresAt,
    },
  });
}

export function deleteByUserAndRouteKey(userId: string, routeKey: string) {
  return prisma.userDraft.deleteMany({
    where: { userId, routeKey },
  });
}
