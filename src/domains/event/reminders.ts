import { prisma } from "@/lib/prisma";
import { publish } from "@/lib/sse";
import { zonedDateTimeToUtc } from "@/lib/date-utils";

const EVENT_REMINDER_LOCK_KEY = 914275;

function normalizeReminderTime(time: string | null | undefined): string {
  const match = time?.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return "00:00";

  const [, hours, minutes] = match;
  return `${hours.padStart(2, "0")}:${minutes}`;
}

export async function checkAndSendReminders(): Promise<void> {
  const now = new Date();
  const pendingPublishes = await prisma.$transaction(async (tx) => {
    const result = await tx.$queryRaw<Array<{ acquired: boolean }>>`
      SELECT pg_try_advisory_xact_lock(${EVENT_REMINDER_LOCK_KEY}) AS acquired
    `;
    if (result[0]?.acquired !== true) return [];

    const events = await tx.event.findMany({
      where: { reminderMinutes: { not: null } },
    });
    const users = await tx.user.findMany({
      where: { active: true },
      select: { id: true },
    });
    const createdNotifications: Array<{
      userId: string;
      notification: {
        id: string;
        type: string;
        title: string;
        message: string | null;
        quoteId: string | null;
        read: boolean;
        createdAt: string;
      };
    }> = [];

    for (const event of events) {
      if (event.reminderMinutes === null) continue;

      const sentDates: string[] = Array.isArray(event.reminderSentDates)
        ? (event.reminderSentDates as string[])
        : [];

      const dateStr = event.date.toISOString().slice(0, 10);

      if (sentDates.includes(dateStr)) continue;

      const reminderTime = zonedDateTimeToUtc(
        dateStr,
        normalizeReminderTime(event.startTime),
      );
      reminderTime.setMinutes(reminderTime.getMinutes() - event.reminderMinutes);

      if (now < reminderTime) continue;

      for (const user of users) {
        const notification = await tx.notification.create({
          data: {
            userId: user.id,
            type: "EVENT_REMINDER",
            title: `Reminder: ${event.title}`,
            message: event.startTime
              ? `Starting at ${event.startTime}${event.location ? ` \u2014 ${event.location}` : ""}`
              : `Today${event.location ? ` \u2014 ${event.location}` : ""}`,
            quoteId: null,
          },
        });
        createdNotifications.push({
          userId: user.id,
          notification: {
            id: notification.id,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            quoteId: notification.quoteId,
            read: notification.read,
            createdAt: notification.createdAt.toISOString(),
          },
        });
      }

      await tx.event.update({
        where: { id: event.id },
        data: {
          reminderSentDates: [...sentDates, dateStr],
        },
      });
    }

    return createdNotifications;
  });

  for (const { userId, notification } of pendingPublishes) {
    publish(userId, notification);
  }
}
