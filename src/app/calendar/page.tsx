import dynamic from "next/dynamic";
import { getCalendarBootstrapData } from "@/domains/calendar/service";

const CalendarView = dynamic(
  () => import("@/components/calendar/calendar-view").then((m) => m.CalendarView),
  { ssr: false },
);

export default async function CalendarPage() {
  const initialData = await getCalendarBootstrapData();

  return <CalendarView initialData={initialData} />;
}
