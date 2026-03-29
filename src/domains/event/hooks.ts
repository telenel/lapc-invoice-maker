"use client";

import { useState, useCallback } from "react";
import { eventApi } from "./api-client";
import type { EventResponse, CreateEventInput, UpdateEventInput } from "./types";

export function useCreateEvent() {
  const [loading, setLoading] = useState(false);
  const createEvent = useCallback(async (input: CreateEventInput): Promise<EventResponse> => {
    setLoading(true);
    try {
      return await eventApi.create(input);
    } finally {
      setLoading(false);
    }
  }, []);
  return { createEvent, loading };
}

export function useUpdateEvent() {
  const [loading, setLoading] = useState(false);
  const updateEvent = useCallback(async (id: string, input: UpdateEventInput): Promise<EventResponse> => {
    setLoading(true);
    try {
      return await eventApi.update(id, input);
    } finally {
      setLoading(false);
    }
  }, []);
  return { updateEvent, loading };
}

export function useDeleteEvent() {
  const [loading, setLoading] = useState(false);
  const deleteEvent = useCallback(async (id: string): Promise<void> => {
    setLoading(true);
    try {
      await eventApi.remove(id);
    } finally {
      setLoading(false);
    }
  }, []);
  return { deleteEvent, loading };
}
