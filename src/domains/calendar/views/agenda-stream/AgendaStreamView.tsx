"use client";

import { useEffect, useMemo, useState } from "react";
import type { ViewProps } from "@fullcalendar/core";
import { MiniMonth } from "@/components/calendar/mini-month";
import { addDaysToDateKey, fromDateKey, getDateKeyInLosAngeles } from "@/lib/date-utils";
import type { CalendarEventItem } from "@/domains/event/types";
import type { AgendaLaneEvent, AgendaStreamDay, AgendaStreamEvent } from "./types";
import { assignColumns, buildAgendaStreamDays, buildAgendaStreamStats, getAgendaSourceMeta, toAgendaStreamEvent } from "./utils";
import styles from "./agendaStream.module.css";

const DAY_START_MIN = 7 * 60;
const DAY_END_MIN = 19 * 60 + 30;
const DAY_RANGE_MIN = DAY_END_MIN - DAY_START_MIN;
const TIMELINE_PIXELS_PER_MINUTE = 1.4;
const ALL_SOURCES = ["MEETING", "SEMINAR", "VENDOR", "OTHER", "catering", "birthday"] as const;
const EMPTY_DATE_KEYS: string[] = [];

interface TimelineLaneEvent extends AgendaLaneEvent {
  originalStartMin: number;
  originalDurMin: number;
}

export interface AgendaStreamViewProps {
  dateProfile?: ViewProps["dateProfile"];
  businessHours?: ViewProps["businessHours"];
  eventStore?: ViewProps["eventStore"];
  eventUiBases?: ViewProps["eventUiBases"];
  dateSelection?: ViewProps["dateSelection"];
  eventSelection?: ViewProps["eventSelection"];
  eventDrag?: ViewProps["eventDrag"];
  eventResize?: ViewProps["eventResize"];
  isHeightAuto?: ViewProps["isHeightAuto"];
  forPrint?: ViewProps["forPrint"];
  weekStart?: string;
  displayMonth?: Date;
  agendaEvents?: AgendaStreamEvent[];
  events?: CalendarEventItem[];
  now?: Date;
  initialExpandedDateKeys?: string[];
  initialShowPast?: boolean;
  onWeekStartChange?: (weekStart: string) => void;
  onDisplayMonthChange?: (date: Date) => void;
  onDateClick?: (dateKey: string) => void;
  onToggleShowPast?: (showPast: boolean) => void;
}

function toMondayDateKey(dateKey: string): string {
  const date = fromDateKey(dateKey);
  const dayOfWeek = date.getUTCDay();
  const offset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  return addDaysToDateKey(dateKey, offset);
}

function deriveWeekStart(dateProfile: ViewProps["dateProfile"] | undefined, explicitWeekStart: string | undefined, now: Date): string {
  if (explicitWeekStart) {
    return toMondayDateKey(explicitWeekStart);
  }

  const viewStart = dateProfile?.currentRange?.start;
  if (viewStart instanceof Date && !Number.isNaN(viewStart.getTime())) {
    return toMondayDateKey(getDateKeyInLosAngeles(viewStart));
  }

  return toMondayDateKey(getDateKeyInLosAngeles(now));
}

function formatDateKey(dateKey: string, options: Intl.DateTimeFormatOptions): string {
  return fromDateKey(dateKey).toLocaleDateString("en-US", {
    ...options,
    timeZone: "UTC",
  });
}

function formatWeekLabel(weekStart: string): string {
  return `Week of ${formatDateKey(weekStart, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

function formatMonthHeading(weekStart: string): string {
  return formatDateKey(weekStart, {
    month: "long",
    year: "numeric",
  });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatTime(minutes: number): string {
  const normalized = ((minutes % (24 * 60)) + (24 * 60)) % (24 * 60);
  const hour24 = Math.floor(normalized / 60);
  const minute = normalized % 60;
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function formatEventTimeLabel(event: { allDay: boolean; startMin: number; durMin: number }): string {
  if (event.allDay) {
    return "All day";
  }

  return `${formatTime(event.startMin)} - ${formatTime(event.startMin + event.durMin)}`;
}

function formatHourLabel(hour24: number): string {
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12} ${suffix}`;
}

function getTimelinePercent(minutes: number): number {
  const clamped = Math.min(DAY_END_MIN, Math.max(DAY_START_MIN, minutes));
  return ((clamped - DAY_START_MIN) / DAY_RANGE_MIN) * 100;
}

function getEventEndMin(event: { startMin: number; durMin: number }): number {
  return event.startMin + event.durMin;
}

function buildTimelineEvents(events: AgendaStreamEvent[]): TimelineLaneEvent[] {
  const clampedEvents = events
    .flatMap<TimelineLaneEvent>((event) => {
      if (event.allDay) {
        return [];
      }

      const clampedStart = Math.max(DAY_START_MIN, event.startMin);
      const clampedEnd = Math.min(DAY_END_MIN, getEventEndMin(event));
      if (clampedEnd <= clampedStart) {
        return [];
      }

      return [
        {
          ...event,
          originalStartMin: event.startMin,
          originalDurMin: event.durMin,
          startMin: clampedStart,
          durMin: clampedEnd - clampedStart,
        },
      ];
    })
    .sort((left, right) => {
      if (left.startMin !== right.startMin) return left.startMin - right.startMin;
      if (left.durMin !== right.durMin) return left.durMin - right.durMin;
      return left.id.localeCompare(right.id);
    });

  const positioned: TimelineLaneEvent[] = [];
  let cluster: TimelineLaneEvent[] = [];
  let clusterEnd = -Infinity;

  function flushCluster() {
    if (cluster.length === 0) {
      return;
    }

    positioned.push(...assignColumns(cluster));
    cluster = [];
    clusterEnd = -Infinity;
  }

  for (const event of clampedEvents) {
    const endMin = getEventEndMin(event);
    if (cluster.length === 0) {
      cluster.push(event);
      clusterEnd = endMin;
      continue;
    }

    if (event.startMin < clusterEnd) {
      cluster.push(event);
      clusterEnd = Math.max(clusterEnd, endMin);
      continue;
    }

    flushCluster();
    cluster.push(event);
    clusterEnd = endMin;
  }

  flushCluster();

  return positioned;
}

function getCompactTrackHeight(events: TimelineLaneEvent[]): number {
  const overlapDepth = events.reduce((maxDepth, event) => Math.max(maxDepth, event.col + 1), 1);
  return Math.max(22, overlapDepth * 22);
}

function buildDensityMap(events: AgendaStreamEvent[]): Record<string, number> {
  return events.reduce<Record<string, number>>((counts, event) => {
    counts[event.dateKey] = (counts[event.dateKey] ?? 0) + 1;
    return counts;
  }, {});
}

function getEventSummary(event: AgendaStreamEvent): string[] {
  const summary: string[] = [];
  if (event.metadata.location) summary.push(event.metadata.location);
  if (event.metadata.headcount != null) summary.push(`${event.metadata.headcount} guests`);
  if (event.metadata.quoteNumber) summary.push(event.metadata.quoteNumber);
  return summary;
}

function LaneCard({ event }: { event: AgendaStreamEvent }) {
  const sourceMeta = getAgendaSourceMeta(event.source);
  const summary = getEventSummary(event);

  return (
    <article className={styles.laneCard}>
      <div
        className={styles.cardRail}
        style={{ backgroundColor: sourceMeta.color }}
        aria-hidden="true"
      />
      <div className={styles.cardBody}>
        <div className={styles.cardHeader}>
          <span className={styles.cardEyebrow}>{sourceMeta.label}</span>
          <span className={styles.cardTime}>{formatEventTimeLabel(event)}</span>
        </div>
        <div className={styles.cardTitle}>{event.title}</div>
        {summary.length > 0 ? (
          <div className={styles.cardMeta}>{summary.join(" · ")}</div>
        ) : null}
      </div>
    </article>
  );
}

function CompactBar({
  dateKey,
  events,
  isToday,
  nowMin,
}: {
  dateKey: string;
  events: TimelineLaneEvent[];
  isToday: boolean;
  nowMin: number | null;
}) {
  const trackHeight = getCompactTrackHeight(events);

  return (
    <div className={styles.compactBar} style={{ minHeight: `${trackHeight + 44}px` }}>
      <div className={styles.compactAxis}>
        {[8, 10, 12, 14, 16, 18].map((hour) => (
          <div
            key={hour}
            className={styles.compactTick}
            style={{ left: `${getTimelinePercent(hour * 60)}%` }}
          >
            {formatHourLabel(hour)}
          </div>
        ))}
        {isToday && nowMin != null ? (
          <div
            className={styles.compactNow}
            style={{ left: `${getTimelinePercent(nowMin)}%`, bottom: `${-(trackHeight + 12)}px` }}
            aria-hidden="true"
          />
        ) : null}
      </div>

      <div className={styles.compactTrack} data-testid={`compact-track-${dateKey}`} style={{ height: `${trackHeight}px` }}>
        {events.map((event) => {
          const sourceMeta = getAgendaSourceMeta(event.source);
          return (
            <div
              key={event.id}
              className={styles.compactEvent}
              data-testid={`compact-event-${event.id}`}
              style={{
                left: `${getTimelinePercent(event.startMin)}%`,
                width: `${Math.max(5, getTimelinePercent(event.startMin + event.durMin) - getTimelinePercent(event.startMin))}%`,
                top: `${event.col * 22}px`,
                backgroundColor: `${sourceMeta.color}20`,
                borderLeftColor: sourceMeta.color,
              }}
              title={`${event.title} · ${formatTime(event.originalStartMin)} - ${formatTime(event.originalStartMin + event.originalDurMin)}`}
            >
              <span className={styles.compactEventTitle}>{event.title}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ExpandedLane({
  day,
  events,
  supplementalEvents,
  isToday,
  nowMin,
}: {
  day: AgendaStreamDay<TimelineLaneEvent>;
  events: TimelineLaneEvent[];
  supplementalEvents: AgendaStreamEvent[];
  isToday: boolean;
  nowMin: number | null;
}) {
  const timelineHeight = DAY_RANGE_MIN * TIMELINE_PIXELS_PER_MINUTE;

  return (
    <div className={styles.expandedLane}>
      <div className={styles.expandedTimeline} style={{ minHeight: `${timelineHeight}px` }}>
        <div className={styles.timelineGutter}>
          {Array.from({ length: 13 }, (_, index) => 7 + index).map((hour) => (
            <div
              key={hour}
              className={styles.timelineHour}
              style={{ top: `${(hour * 60 - DAY_START_MIN) * TIMELINE_PIXELS_PER_MINUTE}px` }}
            >
              {formatHourLabel(hour)}
            </div>
          ))}
        </div>

        <div className={styles.timelineCanvas}>
          {Array.from({ length: 13 }, (_, index) => 7 + index).map((hour) => (
            <div
              key={`hour-${hour}`}
              className={styles.timelineLine}
              style={{ top: `${(hour * 60 - DAY_START_MIN) * TIMELINE_PIXELS_PER_MINUTE}px` }}
            />
          ))}
          {Array.from({ length: 13 }, (_, index) => 7 + index).map((hour) => (
            <div
              key={`half-${hour}`}
              className={styles.timelineHalfLine}
              style={{ top: `${(hour * 60 + 30 - DAY_START_MIN) * TIMELINE_PIXELS_PER_MINUTE}px` }}
            />
          ))}

          {isToday && nowMin != null ? (
            <>
              <div
                className={styles.timelinePast}
                style={{ height: `${Math.max(0, (nowMin - DAY_START_MIN) * TIMELINE_PIXELS_PER_MINUTE)}px` }}
                aria-hidden="true"
              />
              <div
                className={styles.timelineNow}
                style={{ top: `${(nowMin - DAY_START_MIN) * TIMELINE_PIXELS_PER_MINUTE}px` }}
              >
                <span className={styles.timelineNowDot} aria-hidden="true" />
                <span className={styles.timelineNowLabel}>{formatTime(nowMin)}</span>
              </div>
            </>
          ) : null}

          {events.map((event) => {
            const sourceMeta = getAgendaSourceMeta(event.source);
            const top = (event.startMin - DAY_START_MIN) * TIMELINE_PIXELS_PER_MINUTE;
            const height = Math.max(24, event.durMin * TIMELINE_PIXELS_PER_MINUTE - 2);
            const width = 100 / event.colCount;
            const left = event.col * width;

            return (
              <div
                key={event.id}
                className={styles.expandedEvent}
                data-testid={`expanded-event-${event.id}`}
                style={{
                  top: `${top}px`,
                  left: `calc(${left}% + 4px)`,
                  width: `calc(${width}% - 8px)`,
                  height: `${height}px`,
                  backgroundColor: `${sourceMeta.color}18`,
                  borderLeftColor: sourceMeta.color,
                }}
              >
                <div className={styles.expandedEventTitle}>{event.title}</div>
                <div className={styles.expandedEventTime}>{`${formatTime(event.originalStartMin)} - ${formatTime(event.originalStartMin + event.originalDurMin)}`}</div>
              </div>
            );
          })}

          {events.length === 0 ? (
            <div className={styles.emptyExpanded}>No events scheduled for {formatDateKey(day.dateKey, { weekday: "long" })}.</div>
          ) : null}
        </div>
      </div>

      <div className={styles.timelineHint}>
        <span>Double-click empty space to add</span>
        <span>Drag event to reschedule</span>
      </div>

      {supplementalEvents.length > 0 ? (
        <div className={styles.supplementalEvents}>
          <div className={styles.supplementalLabel}>Outside timeline</div>
          <div className={styles.laneCards}>
            {supplementalEvents.map((event) => (
              <LaneCard key={event.id} event={event} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DayLane({
  day,
  expanded,
  isToday,
  nowMin,
  onToggle,
}: {
  day: AgendaStreamDay<AgendaStreamEvent>;
  expanded: boolean;
  isToday: boolean;
  nowMin: number | null;
  onToggle: () => void;
}) {
  const cardEvents = useMemo(() => {
    return [...day.events].sort((left, right) => {
      if (left.startMin !== right.startMin) return left.startMin - right.startMin;
      if (left.durMin !== right.durMin) return left.durMin - right.durMin;
      return left.id.localeCompare(right.id);
    });
  }, [day.events]);
  const timelineEvents = useMemo(() => buildTimelineEvents(cardEvents), [cardEvents]);
  const timelineEventIds = useMemo(() => new Set(timelineEvents.map((event) => event.id)), [timelineEvents]);
  const supplementalEvents = useMemo(
    () => cardEvents.filter((event) => !timelineEventIds.has(event.id)),
    [cardEvents, timelineEventIds],
  );

  const buttonLabel = `${formatDateKey(day.dateKey, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}`;

  return (
    <section className={`${styles.lane} ${isToday ? styles.laneToday : ""} ${expanded ? styles.laneExpanded : ""}`}>
      <button
        type="button"
        className={styles.lanePlate}
        onClick={onToggle}
        aria-expanded={expanded}
        aria-label={buttonLabel}
      >
        <div className={styles.plateEyebrow}>{formatDateKey(day.dateKey, { weekday: "long" }).slice(0, 3).toUpperCase()}</div>
        <div className={styles.plateNumber}>{formatDateKey(day.dateKey, { day: "numeric" })}</div>
        {isToday ? <div className={styles.todayPill}>TODAY</div> : null}
        <div className={styles.plateCount}>{`${cardEvents.length} event${cardEvents.length === 1 ? "" : "s"}`}</div>
      </button>

      <div className={styles.laneBody}>
        {expanded ? (
          <ExpandedLane
            day={{ ...day, events: timelineEvents }}
            events={timelineEvents}
            supplementalEvents={supplementalEvents}
            isToday={isToday}
            nowMin={nowMin}
          />
        ) : (
          <>
            <CompactBar dateKey={day.dateKey} events={timelineEvents} isToday={isToday} nowMin={nowMin} />
            <div className={styles.laneCards}>
              {cardEvents.length > 0 ? (
                cardEvents.slice(0, 4).map((event) => <LaneCard key={event.id} event={event} />)
              ) : (
                <div className={styles.emptyState}>Nothing scheduled.</div>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

export function AgendaStreamView({
  dateProfile,
  weekStart,
  displayMonth,
  agendaEvents,
  events,
  now = new Date(),
  initialExpandedDateKeys,
  initialShowPast = true,
  onWeekStartChange,
  onDisplayMonthChange,
  onDateClick,
  onToggleShowPast,
}: AgendaStreamViewProps) {
  const derivedWeekStart = useMemo(
    () => deriveWeekStart(dateProfile, weekStart, now),
    [dateProfile, weekStart, now],
  );

  const [currentWeekStart, setCurrentWeekStart] = useState(derivedWeekStart);
  const [currentDisplayMonth, setCurrentDisplayMonth] = useState<Date>(
    displayMonth ?? fromDateKey(derivedWeekStart),
  );
  const [showPast, setShowPast] = useState(initialShowPast);
  const expandedSeed = initialExpandedDateKeys ?? EMPTY_DATE_KEYS;
  const expandedSeedKey = expandedSeed.join("|");
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set(expandedSeed));

  useEffect(() => {
    setCurrentWeekStart(derivedWeekStart);
  }, [derivedWeekStart]);

  useEffect(() => {
    if (displayMonth) {
      setCurrentDisplayMonth(displayMonth);
    }
  }, [displayMonth]);

  useEffect(() => {
    if (!displayMonth) {
      setCurrentDisplayMonth(fromDateKey(derivedWeekStart));
    }
  }, [displayMonth, derivedWeekStart]);

  useEffect(() => {
    setShowPast(initialShowPast);
  }, [initialShowPast]);

  useEffect(() => {
    setExpandedKeys(new Set(expandedSeed));
  }, [expandedSeed, expandedSeedKey]);

  const normalizedEvents = useMemo<AgendaStreamEvent[]>(() => {
    if (agendaEvents !== undefined) {
      return agendaEvents;
    }
    return (events ?? []).map(toAgendaStreamEvent);
  }, [agendaEvents, events]);

  const todayDateKey = useMemo(() => getDateKeyInLosAngeles(now), [now]);
  const nowDateKey = todayDateKey;
  const nowMinutes = useMemo(() => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      hourCycle: "h23",
    }).formatToParts(now);

    const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
    const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
    return hour * 60 + minute;
  }, [now]);

  const weekEnd = addDaysToDateKey(currentWeekStart, 4);
  const weekEvents = useMemo(
    () => normalizedEvents.filter((event) => event.dateKey >= currentWeekStart && event.dateKey <= weekEnd),
    [normalizedEvents, currentWeekStart, weekEnd],
  );

  const densityByDate = useMemo(() => buildDensityMap(normalizedEvents), [normalizedEvents]);
  const stats = useMemo(
    () =>
      buildAgendaStreamStats(
        weekEvents.map((event) => ({
          source: event.source,
          amount: event.metadata.amount,
        })),
      ),
    [weekEvents],
  );
  const days = useMemo(() => buildAgendaStreamDays(currentWeekStart, weekEvents), [currentWeekStart, weekEvents]);
  const visibleDays = useMemo(
    () => days.filter((day) => showPast || day.dateKey >= todayDateKey),
    [days, showPast, todayDateKey],
  );

  function updateWeekStart(nextWeekStart: string) {
    const normalizedWeekStart = toMondayDateKey(nextWeekStart);
    setCurrentWeekStart(normalizedWeekStart);
    setCurrentDisplayMonth(fromDateKey(normalizedWeekStart));
    onWeekStartChange?.(normalizedWeekStart);
  }

  function updateDisplayMonth(nextMonth: Date) {
    setCurrentDisplayMonth(nextMonth);
    onDisplayMonthChange?.(nextMonth);
  }

  function toggleShowPast(nextShowPast: boolean) {
    setShowPast(nextShowPast);
    onToggleShowPast?.(nextShowPast);
  }

  function toggleExpanded(dateKey: string) {
    setExpandedKeys((current) => {
      const next = new Set(current);
      if (next.has(dateKey)) {
        next.delete(dateKey);
      } else {
        next.add(dateKey);
      }
      return next;
    });
  }

  return (
    <div className={styles.shell}>
      <header className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <div className={styles.navButtons}>
            <button type="button" className={styles.secondaryButton} onClick={() => updateWeekStart(todayDateKey)}>
              Today
            </button>
            <button
              type="button"
              className={styles.iconButton}
              aria-label="Previous week"
              onClick={() => updateWeekStart(addDaysToDateKey(currentWeekStart, -7))}
            >
              {"<"}
            </button>
            <button
              type="button"
              className={styles.iconButton}
              aria-label="Next week"
              onClick={() => updateWeekStart(addDaysToDateKey(currentWeekStart, 7))}
            >
              {">"}
            </button>
          </div>

          <div>
            <div className={styles.weekLabel}>{formatWeekLabel(currentWeekStart)}</div>
            <h1 className={styles.monthHeading}>{formatMonthHeading(currentWeekStart)}</h1>
          </div>
        </div>

        <div className={styles.topBarRight}>
          <div className={styles.statBlock}>
            <span className={styles.statLabel}>Events</span>
            <span className={styles.statValue}>{`${stats.totalEvents} events`}</span>
          </div>
          <div className={styles.statBlock}>
            <span className={styles.statLabel}>Catering</span>
            <span className={styles.cateringValue}>{formatCurrency(stats.cateringTotal)}</span>
          </div>
          <label className={styles.showPastToggle}>
            <input
              type="checkbox"
              checked={showPast}
              onChange={(event) => toggleShowPast(event.target.checked)}
            />
            <span>Show past</span>
          </label>
        </div>
      </header>

      <div className={styles.body}>
        <aside className={styles.rail}>
          <div className={styles.railSection}>
            <div className={styles.sectionEyebrow}>Jump to</div>
            <MiniMonth
              displayMonth={currentDisplayMonth}
              onMonthChange={updateDisplayMonth}
              onDateClick={(dateKey) => onDateClick?.(dateKey)}
              activeRange={{ start: currentWeekStart, end: addDaysToDateKey(currentWeekStart, 5) }}
              densityByDate={densityByDate}
              selectedWeekStart={currentWeekStart}
              onWeekRowClick={updateWeekStart}
            />
          </div>

          <div className={styles.railSection}>
            <div className={styles.sectionEyebrow}>This week</div>
            <div className={styles.railStatValue}>{`${stats.totalEvents} events`}</div>
            <div className={styles.railStatMeta}>{`${stats.cateringCount} catering · ${formatCurrency(stats.cateringTotal)}`}</div>
          </div>

          <div className={styles.railSection}>
            <div className={styles.sectionEyebrow}>Sources</div>
            <div className={styles.sourceList}>
              {ALL_SOURCES.map((source) => {
                const meta = getAgendaSourceMeta(source);
                const count = weekEvents.filter((event) => event.source === source).length;
                return (
                  <div key={source} className={styles.sourceRow}>
                    <span className={styles.sourceSwatch} style={{ backgroundColor: meta.color }} aria-hidden="true" />
                    <span className={styles.sourceLabel}>{meta.label}</span>
                    <span className={styles.sourceCount}>{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        <main className={styles.laneStack}>
          {visibleDays.map((day) => (
            <DayLane
              key={day.dateKey}
              day={day}
              expanded={expandedKeys.has(day.dateKey)}
              isToday={day.dateKey === nowDateKey}
              nowMin={day.dateKey === nowDateKey ? nowMinutes : null}
              onToggle={() => toggleExpanded(day.dateKey)}
            />
          ))}
        </main>
      </div>
    </div>
  );
}
