import { eventApi } from "@/domains/event/api-client";
import type { CreateEventInput, EventType, UpdateEventInput } from "@/domains/event/types";

export const AGENDA_PREFERENCES_KEY = "agenda-v2";
export const AGENDA_DAY_START_MIN = 7 * 60;
export const AGENDA_DAY_END_MIN = 19 * 60 + 30;
export const AGENDA_DEFAULT_DURATION_MIN = 60;
export const AGENDA_MINUTE_INCREMENT = 15;

export interface AgendaPreferences {
  weekStart: string | null;
  expanded: string[];
  showPast: boolean;
  activeSources: string[];
}

export interface CreateManualAgendaEventInput {
  title: string;
  type?: EventType;
  date: string;
  startTime: string;
  endTime: string;
  location?: string | null;
  description?: string | null;
}

export interface RescheduleManualAgendaEventInput {
  date: string;
  startTime: string;
  endTime: string;
}

const DEFAULT_AGENDA_PREFERENCES: AgendaPreferences = {
  weekStart: null,
  expanded: [],
  showPast: true,
  activeSources: ["MEETING", "SEMINAR", "VENDOR", "OTHER", "catering", "birthday"],
};

type AgendaStorage = {
  getItem?: (key: string) => string | null;
  setItem?: (key: string, value: string) => void;
  removeItem?: (key: string) => void;
  [key: string]: unknown;
};

function cloneDefaults(): AgendaPreferences {
  return {
    weekStart: DEFAULT_AGENDA_PREFERENCES.weekStart,
    expanded: [...DEFAULT_AGENDA_PREFERENCES.expanded],
    showPast: DEFAULT_AGENDA_PREFERENCES.showPast,
    activeSources: [...DEFAULT_AGENDA_PREFERENCES.activeSources],
  };
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function normalizePreferences(value: unknown): AgendaPreferences {
  if (!value || typeof value !== "object") {
    return cloneDefaults();
  }

  const raw = value as Partial<AgendaPreferences>;

  return {
    weekStart: typeof raw.weekStart === "string" ? raw.weekStart : null,
    expanded: isStringArray(raw.expanded) ? [...raw.expanded] : [...DEFAULT_AGENDA_PREFERENCES.expanded],
    showPast: typeof raw.showPast === "boolean" ? raw.showPast : DEFAULT_AGENDA_PREFERENCES.showPast,
    activeSources: isStringArray(raw.activeSources)
      ? [...raw.activeSources]
      : [...DEFAULT_AGENDA_PREFERENCES.activeSources],
  };
}

function readStoredValue(storage: AgendaStorage, key: string): string | null {
  if (typeof storage.getItem === "function") {
    return storage.getItem(key);
  }

  const value = storage[key];
  return typeof value === "string" ? value : null;
}

function writeStoredValue(storage: AgendaStorage, key: string, value: string) {
  if (typeof storage.setItem === "function") {
    storage.setItem(key, value);
    return;
  }

  storage[key] = value;
}

export function snapAgendaMinutes(minutes: number): number {
  return Math.round(minutes / AGENDA_MINUTE_INCREMENT) * AGENDA_MINUTE_INCREMENT;
}

export function clampAgendaMinutes(minutes: number): number {
  return Math.min(AGENDA_DAY_END_MIN, Math.max(AGENDA_DAY_START_MIN, minutes));
}

export function clampAgendaEventStart(startMin: number, durationMin: number): number {
  return Math.min(
    AGENDA_DAY_END_MIN - durationMin,
    Math.max(AGENDA_DAY_START_MIN, startMin),
  );
}

export function minutesToTimeString(minutes: number): string {
  const normalized = ((minutes % (24 * 60)) + (24 * 60)) % (24 * 60);
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export async function createManualAgendaEvent(input: CreateManualAgendaEventInput) {
  const payload: CreateEventInput = {
    title: input.title,
    type: input.type ?? "MEETING",
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    allDay: false,
    location: input.location ?? null,
    description: input.description ?? null,
  };

  return eventApi.create(payload);
}

export async function rescheduleManualAgendaEvent(
  eventId: string,
  input: RescheduleManualAgendaEventInput,
) {
  const payload: UpdateEventInput = {
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    allDay: false,
  };

  return eventApi.update(eventId, payload);
}

export function loadAgendaPreferences(): AgendaPreferences {
  if (typeof window === "undefined") {
    return cloneDefaults();
  }

  try {
    const raw = readStoredValue(window.localStorage as AgendaStorage, AGENDA_PREFERENCES_KEY);
    if (!raw) {
      return cloneDefaults();
    }

    return normalizePreferences(JSON.parse(raw));
  } catch {
    return cloneDefaults();
  }
}

export function saveAgendaPreferences(value: AgendaPreferences) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    writeStoredValue(
      window.localStorage as AgendaStorage,
      AGENDA_PREFERENCES_KEY,
      JSON.stringify({
        weekStart: value.weekStart,
        expanded: [...value.expanded],
        showPast: value.showPast,
        activeSources: [...value.activeSources],
      }),
    );
  } catch {
    // Ignore storage quota / privacy-mode failures so preference changes fail softly.
  }
}
