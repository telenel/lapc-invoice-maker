import { prisma } from "@/lib/prisma";

export async function create(data: {
  title: string;
  type: string;
  date: Date;
  color: string;
  allDay: boolean;
  startTime?: string | null;
  endTime?: string | null;
  description?: string | null;
  location?: string | null;
  recurrence?: string | null;
  recurrenceEnd?: Date | null;
  reminderMinutes?: number | null;
  createdBy: string;
}) {
  return prisma.event.create({ data });
}

export async function findByDateRange(start: Date, end: Date) {
  return prisma.event.findMany({
    where: { date: { gte: start, lte: end } },
    orderBy: { date: "asc" },
  });
}

export async function findById(id: string) {
  return prisma.event.findUnique({ where: { id } });
}

export async function update(id: string, data: Record<string, unknown>) {
  return prisma.event.update({ where: { id }, data });
}

export async function remove(id: string) {
  return prisma.event.delete({ where: { id } });
}

export async function findDueReminders() {
  return prisma.event.findMany({
    where: { reminderMinutes: { not: null } },
  });
}
