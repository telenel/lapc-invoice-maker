"use client";

import { useSSE } from "@/lib/use-sse";

/**
 * Listens to the SSE stream for "calendar-changed" events and triggers a callback.
 * Debounces rapid-fire mutations (e.g., chatbot creating multiple events).
 */
export function useCalendarSSE(onCalendarChanged: () => void) {
  useSSE("calendar-changed", onCalendarChanged);
}
