import Link from "next/link";
import { Plus, FileText, Sun, Sunset, Moon } from "lucide-react";

type TimeOfDay = "morning" | "afternoon" | "evening";

const PORTAL_TIME_ZONE = "America/Los_Angeles";

function getTimeOfDay(date: Date): TimeOfDay {
  const formatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: false,
    timeZone: PORTAL_TIME_ZONE,
  });
  const hour = Number(formatter.format(date));
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

const greetingMap: Record<TimeOfDay, string> = {
  morning: "Good morning",
  afternoon: "Good afternoon",
  evening: "Good evening",
};

const iconMap: Record<TimeOfDay, typeof Sun> = {
  morning: Sun,
  afternoon: Sunset,
  evening: Moon,
};

const iconColorMap: Record<TimeOfDay, string> = {
  morning: "text-muted-foreground",
  afternoon: "text-muted-foreground",
  evening: "text-muted-foreground",
};

function getFormattedDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: PORTAL_TIME_ZONE,
  }).format(date);
}

export function PersonalizedHeader({ name = "" }: { name?: string }) {
  const now = new Date();
  const timeOfDay = getTimeOfDay(now);
  const date = getFormattedDate(now);
  const firstName = name.split(" ")[0] ?? "";
  const Icon = iconMap[timeOfDay];

  return (
    <div className="pb-1">
      <div className="flex items-end justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${iconColorMap[timeOfDay]}`} aria-hidden="true" />
            <h1 className="text-2xl font-bold tracking-tight">
              {greetingMap[timeOfDay]}{firstName ? `, ${firstName}` : ""}
            </h1>
          </div>
          <p className="text-[13px] text-muted-foreground mt-0.5 ml-7">{date}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/quotes/new"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-green-600 to-green-800 px-3 text-sm font-semibold text-white transition-colors hover:from-green-700 hover:to-green-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <FileText className="h-4 w-4" aria-hidden="true" />
            New Quote
          </Link>
          <Link
            href="/invoices/new"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-red-600 to-red-800 px-3 text-sm font-semibold text-white transition-colors hover:from-red-700 hover:to-red-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Invoice
          </Link>
        </div>
      </div>
    </div>
  );
}
