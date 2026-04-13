import nextDynamic from "next/dynamic";
import { getCalendarBootstrapData } from "@/domains/calendar/service";

export const dynamic = "force-dynamic";

const CalendarView = nextDynamic(
  () => import("@/components/calendar/calendar-view").then((m) => m.CalendarView),
  { ssr: false },
);

export default async function CalendarPage() {
  const initialData = await getCalendarBootstrapData();

  return <CalendarView initialData={initialData} />;
}
