import * as eventRepository from "./repository";
import { notificationService } from "@/domains/notification/service";
import { prisma } from "@/lib/prisma";

const EVENT_REMINDER_LOCK_KEY = 914275;

async function acquireEventReminderLock(): Promise<boolean> {
  const result = await prisma.$queryRaw<Array<{ acquired: boolean }>>`
    SELECT pg_try_advisory_lock(${EVENT_REMINDER_LOCK_KEY}) AS acquired
  `;

  return result[0]?.acquired === true;
}

async function releaseEventReminderLock(): Promise<void> {
  await prisma.$queryRaw`
    SELECT pg_advisory_unlock(${EVENT_REMINDER_LOCK_KEY})
  `;
}

export async function checkAndSendReminders(): Promise<void> {
  const lockAcquired = await acquireEventReminderLock();
  if (!lockAcquired) return;

  const now = new Date();
  try {
    const events = await eventRepository.findDueReminders();

    for (const event of events) {
      if (event.reminderMinutes === null) continue;

      const sentDates: string[] = Array.isArray(event.reminderSentDates)
        ? (event.reminderSentDates as string[])
        : [];

      const eventDate = new Date(event.date);
      const dateStr = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, "0")}-${String(eventDate.getDate()).padStart(2, "0")}`;

      if (sentDates.includes(dateStr)) continue;

      const reminderTime = new Date(eventDate);
      if (event.startTime && /^\d{1,2}:\d{2}$/.test(event.startTime)) {
        const [hours, minutes] = event.startTime.split(":").map(Number);
        if (!isNaN(hours) && !isNaN(minutes)) {
          reminderTime.setHours(hours, minutes, 0, 0);
        }
      }
      reminderTime.setMinutes(reminderTime.getMinutes() - event.reminderMinutes);

      if (now < reminderTime) continue;

      const users = await prisma.user.findMany({
        where: { active: true },
        select: { id: true },
      });

      for (const user of users) {
        await notificationService.createAndPublish({
          userId: user.id,
          type: "EVENT_REMINDER",
          title: `Reminder: ${event.title}`,
          message: event.startTime
            ? `Starting at ${event.startTime}${event.location ? ` \u2014 ${event.location}` : ""}`
            : `Today${event.location ? ` \u2014 ${event.location}` : ""}`,
        });
      }

      await eventRepository.update(event.id, {
        reminderSentDates: [...sentDates, dateStr],
      });
    }
  } finally {
    await releaseEventReminderLock();
  }
}
