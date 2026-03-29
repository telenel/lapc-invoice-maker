"use client";

import { useEffect, useRef } from "react";

export function useSSE(eventType: string, callback: () => void, debounceMs = 500) {
  const cbRef = useRef(callback);
  cbRef.current = callback;
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const es = new EventSource("/api/notifications/stream");
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === eventType) {
          clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => cbRef.current(), debounceMs);
        }
      } catch {
        // Ignore parse errors
      }
    };
    return () => {
      es.close();
      clearTimeout(timerRef.current);
    };
  }, [eventType, debounceMs]);
}
