"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateEvent, useUpdateEvent, useDeleteEvent } from "@/domains/event/hooks";
import { EVENT_TYPE_COLORS } from "@/domains/event/types";
import type {
  EventResponse,
  EventType,
  Recurrence,
  CreateEventInput,
  UpdateEventInput,
} from "@/domains/event/types";

interface AddEventModalProps {
  event?: EventResponse;
  onSave: () => void;
  trigger: React.ReactNode;
  defaultOpen?: boolean;
}

const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: "MEETING", label: "Meeting" },
  { value: "SEMINAR", label: "Seminar" },
  { value: "VENDOR", label: "Vendor" },
  { value: "OTHER", label: "Other" },
];

const RECURRENCE_OPTIONS: { value: Recurrence | "none"; label: string }[] = [
  { value: "none", label: "None" },
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "YEARLY", label: "Yearly" },
];

const REMINDER_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: "None" },
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 60, label: "1 hr" },
  { value: 120, label: "2 hr" },
  { value: 1440, label: "1 day" },
];

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function AddEventModal({ event, onSave, trigger, defaultOpen = false }: AddEventModalProps) {
  const [open, setOpen] = useState(defaultOpen);
  const { createEvent, loading: creating } = useCreateEvent();
  const { updateEvent, loading: updating } = useUpdateEvent();
  const { deleteEvent, loading: deleting } = useDeleteEvent();

  const isEdit = !!event;
  const loading = creating || updating || deleting;

  const [title, setTitle] = useState("");
  const [type, setType] = useState<EventType>("MEETING");
  const [date, setDate] = useState(todayStr());
  const [allDay, setAllDay] = useState(false);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [recurrence, setRecurrence] = useState<Recurrence | "none">("none");
  const [recurrenceEnd, setRecurrenceEnd] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(60);

  function handleOpen() {
    setTitle(event?.title ?? "");
    setType(event?.type ?? "MEETING");
    setDate(event?.date ?? todayStr());
    setAllDay(event?.allDay ?? false);
    setStartTime(event?.startTime ?? "09:00");
    setEndTime(event?.endTime ?? "10:00");
    setRecurrence(event?.recurrence ?? "none");
    setRecurrenceEnd(event?.recurrenceEnd ?? "");
    setLocation(event?.location ?? "");
    setDescription(event?.description ?? "");
    setReminderMinutes(event?.reminderMinutes ?? 60);
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      if (isEdit) {
        const input: UpdateEventInput = {
          title,
          type,
          date,
          allDay,
          startTime: allDay ? null : startTime,
          endTime: allDay ? null : endTime,
          recurrence: recurrence === "none" ? null : recurrence,
          recurrenceEnd: recurrence !== "none" && recurrenceEnd ? recurrenceEnd : null,
          location: location || null,
          description: description || null,
          reminderMinutes,
        };
        await updateEvent(event.id, input);
      } else {
        const input: CreateEventInput = {
          title,
          type,
          date,
          allDay,
          ...(allDay ? {} : { startTime, endTime }),
          ...(recurrence !== "none" ? { recurrence } : {}),
          ...(recurrence !== "none" && recurrenceEnd ? { recurrenceEnd } : {}),
          ...(location ? { location } : {}),
          ...(description ? { description } : {}),
          reminderMinutes: reminderMinutes ?? undefined,
        };
        await createEvent(input);
      }

      toast.success(isEdit ? "Event updated" : "Event created");
      setOpen(false);
      onSave();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save event");
    }
  }

  async function handleDelete() {
    if (!event) return;
    if (!window.confirm("Delete this event? This cannot be undone.")) return;

    try {
      await deleteEvent(event.id);
      toast.success("Event deleted");
      setOpen(false);
      onSave();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete event");
    }
  }

  return (
    <>
      <div onClick={handleOpen} role="button" tabIndex={-1} style={{ display: "contents" }}>
        {trigger}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit Event" : "Add Event"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-4 py-2">
            {/* Title */}
            <div className="grid gap-1.5">
              <Label htmlFor="event-title">Title</Label>
              <Input
                id="event-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Staff meeting..."
                required
              />
            </div>

            {/* Type - pill selector */}
            <div className="grid gap-1.5">
              <Label>Type</Label>
              <div className="flex flex-wrap gap-2">
                {EVENT_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setType(t.value)}
                    className="rounded-full px-3 py-1 text-xs font-medium transition-colors border"
                    style={
                      type === t.value
                        ? {
                            backgroundColor: `${EVENT_TYPE_COLORS[t.value]}20`,
                            borderColor: EVENT_TYPE_COLORS[t.value],
                            color: EVENT_TYPE_COLORS[t.value],
                          }
                        : {
                            backgroundColor: "transparent",
                            borderColor: "var(--border)",
                            color: "var(--muted-foreground)",
                          }
                    }
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Date */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="event-date">Date</Label>
                <Input
                  id="event-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
              <div className="flex items-end gap-2 pb-1">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={allDay}
                    onChange={(e) => setAllDay(e.target.checked)}
                    className="h-4 w-4"
                  />
                  All Day
                </label>
              </div>
            </div>

            {/* Time fields (hidden when allDay) */}
            {!allDay && (
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="event-start-time">Start Time</Label>
                  <Input
                    id="event-start-time"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="event-end-time">End Time</Label>
                  <Input
                    id="event-end-time"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Recurrence - pill selector */}
            <div className="grid gap-1.5">
              <Label>Repeat</Label>
              <div className="flex flex-wrap gap-2">
                {RECURRENCE_OPTIONS.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRecurrence(r.value)}
                    className="rounded-full px-3 py-1 text-xs font-medium transition-colors border"
                    style={
                      recurrence === r.value
                        ? {
                            backgroundColor: "var(--primary)",
                            borderColor: "var(--primary)",
                            color: "var(--primary-foreground)",
                          }
                        : {
                            backgroundColor: "transparent",
                            borderColor: "var(--border)",
                            color: "var(--muted-foreground)",
                          }
                    }
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Recurrence End (shown when repeat is set) */}
            {recurrence !== "none" && (
              <div className="grid gap-1.5">
                <Label htmlFor="event-recurrence-end">Recurrence End</Label>
                <Input
                  id="event-recurrence-end"
                  type="date"
                  value={recurrenceEnd}
                  onChange={(e) => setRecurrenceEnd(e.target.value)}
                />
              </div>
            )}

            {/* Location */}
            <div className="grid gap-1.5">
              <Label htmlFor="event-location">Location</Label>
              <Input
                id="event-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Room 1600..."
              />
            </div>

            {/* Description */}
            <div className="grid gap-1.5">
              <Label htmlFor="event-description">Description</Label>
              <textarea
                id="event-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional notes..."
                rows={3}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            {/* Reminder - pill selector */}
            <div className="grid gap-1.5">
              <Label>Reminder</Label>
              <div className="flex flex-wrap gap-2">
                {REMINDER_OPTIONS.map((r) => (
                  <button
                    key={String(r.value)}
                    type="button"
                    onClick={() => setReminderMinutes(r.value)}
                    className="rounded-full px-3 py-1 text-xs font-medium transition-colors border"
                    style={
                      reminderMinutes === r.value
                        ? {
                            backgroundColor: "var(--primary)",
                            borderColor: "var(--primary)",
                            color: "var(--primary-foreground)",
                          }
                        : {
                            backgroundColor: "transparent",
                            borderColor: "var(--border)",
                            color: "var(--muted-foreground)",
                          }
                    }
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <DialogFooter>
              <div className="flex w-full items-center justify-between">
                {isEdit ? (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={loading}
                  >
                    Delete
                  </Button>
                ) : (
                  <div />
                )}
                <Button type="submit" disabled={loading}>
                  {loading
                    ? "Saving..."
                    : isEdit
                    ? "Save Changes"
                    : "Add Event"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
