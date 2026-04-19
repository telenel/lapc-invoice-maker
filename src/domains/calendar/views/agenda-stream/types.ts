import type { CalendarEventItem, EventType } from "@/domains/event/types";

export type AgendaSourceKey = EventType | "catering" | "birthday";

export interface AgendaEventMetadata {
  amount: number | null;
  location: string | null;
  headcount: number | null;
  quoteId: string | null;
  quoteNumber: string | null;
  quoteStatus: string | null;
  staffId: string | null;
  eventId: string | null;
  description: string | null;
  setupTime: string | null;
  takedownTime: string | null;
}

export interface AgendaStreamEvent {
  id: string;
  calendarEventId: string;
  dateKey: string;
  startMin: number;
  durMin: number;
  source: AgendaSourceKey;
  title: string;
  metadata: AgendaEventMetadata;
  readOnly: boolean;
  allDay: boolean;
  original: CalendarEventItem;
}

export interface AgendaLaneEvent extends AgendaStreamEvent {
  col: number;
  colCount: number;
}

export interface AgendaStreamDay<TEvent = AgendaStreamEvent> {
  date: Date;
  dateKey: string;
  events: TEvent[];
}

export interface AgendaSourceMeta {
  label: string;
  color: string;
  icon: string;
}

export interface AgendaStreamStats {
  totalEvents: number;
  cateringCount: number;
  cateringTotal: number;
}
