export type EventType = "service" | "discipleship" | "bible_study" | "prayer" | "baptism" | "fasting_season" | "special_event" | "announcement";
export type EventMode = "in_person" | "online" | "hybrid";
export type EventStatus = "draft" | "published" | "cancelled";
export type RecurrencePattern = "weekly" | "one_time" | "custom";
export type EventVisibility = "public" | "admin_only";

export type ChurchEvent = {
  id: number;
  eventId?: number;
  title: string;
  eventType: EventType;
  description: string | null;
  startDatetime: string;
  endDatetime: string;
  occurrenceStartDatetime?: string;
  occurrenceEndDatetime?: string;
  location: string | null;
  eventMode: EventMode;
  zoomLink: string | null;
  youtubeLink: string | null;
  posterUrl: string | null;
  isRecurring: boolean;
  recurrencePattern: RecurrencePattern;
  recurrenceDay: number | null;
  recurrenceTime: string | null;
  visibility: EventVisibility;
  status: EventStatus;
  createdByUserId: number | null;
  createdAt: string;
  updatedAt: string;
  linkedSessionCount?: number;
  linkedAttendanceCount?: number;
};

export type EventFormState = {
  title: string;
  eventType: EventType;
  description: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  location: string;
  eventMode: EventMode;
  zoomLink: string;
  youtubeLink: string;
  posterUrl: string;
  isRecurring: boolean;
  recurrencePattern: RecurrencePattern;
  visibility: EventVisibility;
  status: EventStatus;
};

export const emptyEventForm: EventFormState = {
  title: "",
  eventType: "service",
  description: "",
  startDate: "",
  startTime: "",
  endDate: "",
  endTime: "",
  location: "",
  eventMode: "in_person",
  zoomLink: "",
  youtubeLink: "",
  posterUrl: "",
  isRecurring: false,
  recurrencePattern: "one_time",
  visibility: "public",
  status: "draft",
};

export { apiJson } from "@/lib/api";

export function labelize(value: string | null | undefined) {
  if (!value) return "Not set";
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function eventStart(event: ChurchEvent) {
  return event.occurrenceStartDatetime ?? event.startDatetime;
}

export function eventEnd(event: ChurchEvent) {
  return event.occurrenceEndDatetime ?? event.endDatetime;
}

export function dayBounds(day: Date) {
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(day);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function eventSpansDay(event: ChurchEvent, day: Date) {
  const { start, end } = dayBounds(day);
  return new Date(eventStart(event)) <= end && new Date(eventEnd(event)) >= start;
}

export function isMultiDayEvent(event: ChurchEvent) {
  return new Date(eventStart(event)).toDateString() !== new Date(eventEnd(event)).toDateString();
}

export function spanPosition(event: ChurchEvent, day: Date) {
  const dayKey = day.toDateString();
  const startsToday = new Date(eventStart(event)).toDateString() === dayKey;
  const endsToday = new Date(eventEnd(event)).toDateString() === dayKey;
  if (startsToday && endsToday) return "single";
  if (startsToday) return "start";
  if (endsToday) return "end";
  return "middle";
}

export function shouldShowSpanLabel(event: ChurchEvent, day: Date) {
  const position = spanPosition(event, day);
  return position === "start" || position === "single" || day.getDay() === 0 || day.getDate() === 1;
}

export function eventTypeCalendarClasses(eventType: EventType) {
  const classes: Record<EventType, { single: string; span: string }> = {
    service: {
      single: "bg-indigo-100 text-indigo-800 hover:bg-indigo-200",
      span: "bg-indigo-500 text-white hover:bg-indigo-600",
    },
    discipleship: {
      single: "bg-emerald-100 text-emerald-800 hover:bg-emerald-200",
      span: "bg-emerald-600 text-white hover:bg-emerald-700",
    },
    bible_study: {
      single: "bg-sky-100 text-sky-800 hover:bg-sky-200",
      span: "bg-sky-500 text-white hover:bg-sky-600",
    },
    prayer: {
      single: "bg-violet-100 text-violet-800 hover:bg-violet-200",
      span: "bg-violet-500 text-white hover:bg-violet-600",
    },
    baptism: {
      single: "bg-cyan-100 text-cyan-800 hover:bg-cyan-200",
      span: "bg-cyan-500 text-white hover:bg-cyan-600",
    },
    fasting_season: {
      single: "bg-amber-100 text-amber-900 hover:bg-amber-200",
      span: "bg-amber-500 text-white hover:bg-amber-600",
    },
    special_event: {
      single: "bg-rose-100 text-rose-800 hover:bg-rose-200",
      span: "bg-rose-500 text-white hover:bg-rose-600",
    },
    announcement: {
      single: "bg-slate-100 text-slate-800 hover:bg-slate-200",
      span: "bg-slate-500 text-white hover:bg-slate-600",
    },
  };
  return classes[eventType];
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(new Date(value));
}

export function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export function formatDateTimeRange(event: ChurchEvent) {
  const start = eventStart(event);
  const end = eventEnd(event);
  return `${formatDate(start)} · ${formatTime(start)} - ${formatTime(end)}`;
}

export function formFromEvent(event: ChurchEvent): EventFormState {
  const start = new Date(event.startDatetime);
  const end = new Date(event.endDatetime);
  return {
    title: event.title,
    eventType: event.eventType,
    description: event.description ?? "",
    startDate: start.toISOString().slice(0, 10),
    startTime: start.toTimeString().slice(0, 5),
    endDate: end.toISOString().slice(0, 10),
    endTime: end.toTimeString().slice(0, 5),
    location: event.location ?? "",
    eventMode: event.eventMode,
    zoomLink: event.zoomLink ?? "",
    youtubeLink: event.youtubeLink ?? "",
    posterUrl: event.posterUrl ?? "",
    isRecurring: event.isRecurring,
    recurrencePattern: event.recurrencePattern,
    visibility: event.visibility,
    status: event.status,
  };
}

export function payloadFromEventForm(form: EventFormState) {
  const startDatetime = new Date(`${form.startDate}T${form.startTime || "00:00"}`).toISOString();
  const endDatetime = new Date(`${form.endDate || form.startDate}T${form.endTime || form.startTime || "00:00"}`).toISOString();
  return {
    title: form.title.trim(),
    eventType: form.eventType,
    description: form.description.trim(),
    startDatetime,
    endDatetime,
    location: form.location.trim(),
    eventMode: form.eventMode,
    zoomLink: form.zoomLink.trim(),
    youtubeLink: form.youtubeLink.trim(),
    posterUrl: form.posterUrl.trim(),
    isRecurring: form.isRecurring,
    recurrencePattern: form.isRecurring ? form.recurrencePattern : "one_time",
    visibility: form.visibility,
    status: form.status,
  };
}

export function defaultMonthRange(anchor = new Date()) {
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0, 23, 59, 59);
  return { start: start.toISOString(), end: end.toISOString() };
}
