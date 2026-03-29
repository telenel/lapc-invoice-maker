import * as eventRepository from "./repository";
import { notificationService } from "@/domains/notification/service";
import { prisma } from "@/lib/prisma";

export async function checkAndSendReminders(): Promise<void> {
  const now = new Date();
  const events = await eventRepository.findDueReminders();

  for (const event of events) {
    if (event.reminderMinutes === null) continue;

    const sentDates: string[] = Array.isArray(event.reminderSentDates)
      ? (event.reminderSentDates as string[])
      : [];

    const eventDate = new Date(event.date);
    const dateStr = eventDate.toISOString().split("T")[0];

    if (sentDates.includes(dateStr)) continue;

    const reminderTime = new Date(eventDate);
    if (event.startTime) {
      const [hours, minutes] = event.startTime.split(":").map(Number);
      reminderTime.setHours(hours, minutes, 0, 0);
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
        type: "QUOTE_VIEWED" as never,
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
}
