import dynamic from "next/dynamic";

const CalendarView = dynamic(
  () => import("@/components/calendar/calendar-view").then((m) => m.CalendarView),
  { ssr: false },
);

export default function CalendarPage() {
  return <CalendarView />;
}
