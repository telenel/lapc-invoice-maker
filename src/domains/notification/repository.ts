// src/domains/notification/repository.ts
import { prisma } from "@/lib/prisma";
import type { CreateNotificationInput } from "./types";

export async function create(input: CreateNotificationInput) {
  return prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message ?? null,
      quoteId: input.quoteId ?? null,
    },
  });
}

export async function findByUserId(userId: string, limit = 20, offset = 0) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: [{ read: "asc" }, { createdAt: "desc" }],
    take: limit,
    skip: offset,
  });
}

export async function countUnread(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { userId, read: false },
  });
}

export async function markRead(id: string) {
  return prisma.notification.update({
    where: { id },
    data: { read: true },
  });
}

export async function markAllRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
}

export async function deleteById(id: string): Promise<void> {
  await prisma.notification.delete({ where: { id } });
}
