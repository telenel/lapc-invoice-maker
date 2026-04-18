export const AGENDA_PREFERENCES_KEY = "agenda-v2";

export interface AgendaPreferences {
  weekStart: string | null;
  expanded: string[];
  showPast: boolean;
  activeSources: string[];
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
}
