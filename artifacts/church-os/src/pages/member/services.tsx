import React from "react";
import { Link, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import MemberLayout from "@/components/MemberLayout";
import PageHeader from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  apiJson,
  defaultMonthRange,
  eventTypeCalendarClasses,
  eventSpansDay,
  eventStart,
  formatDate,
  formatDateTimeRange,
  formatTime,
  isMultiDayEvent,
  labelize,
  shouldShowSpanLabel,
  spanPosition,
  type ChurchEvent,
} from "@/lib/events";
import { ArrowLeft, CalendarDays, ExternalLink, Search, Video } from "lucide-react";

export default function MemberServices() {
  const [, params] = useRoute("/member/services/:id");
  return params?.id ? <MemberEventDetail eventId={Number(params.id)} /> : <MemberEventsCalendar />;
}

function EventBadges({ event }: { event: ChurchEvent }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge variant="outline" className="border-amber-200 bg-white text-amber-800">{labelize(event.eventType)}</Badge>
      {event.isRecurring && <Badge variant="outline">Weekly</Badge>}
      {event.eventMode !== "in_person" && <Badge variant="outline"><Video className="mr-1 h-3 w-3" />{labelize(event.eventMode)}</Badge>}
      {event.youtubeLink && <Badge variant="outline">YouTube</Badge>}
      {event.status === "cancelled" && <Badge variant="destructive">Cancelled</Badge>}
    </div>
  );
}

function MemberEventsCalendar() {
  const [search, setSearch] = React.useState("");
  const [eventType, setEventType] = React.useState("");
  const [month, setMonth] = React.useState(new Date());
  const range = React.useMemo(() => defaultMonthRange(month), [month]);
  const eventsQuery = useQuery({
    queryKey: ["member-events", search, eventType, range.start, range.end],
    queryFn: () => {
      const params = new URLSearchParams({ start: range.start, end: range.end, limit: "250" });
      if (search.trim()) params.set("search", search.trim());
      if (eventType) params.set("eventType", eventType);
      return apiJson<{ events: ChurchEvent[] }>(`/events?${params}`);
    },
  });
  const upcomingQuery = useQuery({
    queryKey: ["member-upcoming-events"],
    queryFn: () => apiJson<{ events: ChurchEvent[] }>("/events?limit=10"),
  });
  const events = eventsQuery.data?.events ?? [];
  const upcoming = upcomingQuery.data?.events ?? [];
  const days = calendarDays(month);

  return (
    <MemberLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          eyebrow="Church Calendar"
          title="Services & Events"
          description="Published services, discipleship, announcements, and special events."
          icon={<CalendarDays className="h-6 w-6" />}
          actions={<Button variant="outline" onClick={() => setMonth(new Date())}>Today</Button>}
        />

        <div className="space-y-4">
          <Card className="overflow-hidden border-blue-100 bg-blue-50/45 shadow-sm">
            <div className="h-1 bg-blue-500" />
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-100 text-blue-700">
                      <CalendarDays className="h-4 w-4" />
                    </span>
                    Calendar
                  </CardTitle>
                  <CardDescription>{month.toLocaleString(undefined, { month: "long", year: "numeric" })}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>Previous</Button>
                  <Button variant="outline" size="sm" onClick={() => setMonth(new Date())}>Today</Button>
                  <Button variant="outline" size="sm" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>Next</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-[1fr_220px]">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Search events" value={search} onChange={(event) => setSearch(event.target.value)} />
                </div>
                <select value={eventType} onChange={(event) => setEventType(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">All types</option>
                  <option value="service">Service</option>
                  <option value="discipleship">Discipleship</option>
                  <option value="bible_study">Bible Study</option>
                  <option value="prayer">Prayer</option>
                  <option value="baptism">Baptism</option>
                  <option value="fasting_season">Fasting Season</option>
                  <option value="special_event">Special Event</option>
                  <option value="announcement">Announcement</option>
                </select>
              </div>

              <div className="grid grid-cols-7 overflow-hidden rounded-md border border-blue-100 bg-white/75">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div key={day} className="border-b border-blue-100 bg-blue-50 p-2 text-center text-xs font-medium text-blue-800">{day}</div>
                ))}
                {days.map((day) => {
                  const dayEvents = events.filter((event) => eventSpansDay(event, day.date));
                  return (
                    <div key={day.key} className={`min-h-28 border-b border-r border-blue-100 p-2 ${day.inMonth ? "bg-white/80" : "bg-blue-50/40 text-muted-foreground"}`}>
                      <p className="text-xs font-medium">{day.date.getDate()}</p>
                      <div className="mt-2 space-y-1">
                        {dayEvents.slice(0, 3).map((event) => (
                          <Link key={`${event.id}-${eventStart(event)}-${day.key}`} href={`/member/services/${event.id}`} className={calendarEventClass(event, day.date)} title={shouldShowSpanLabel(event, day.date) ? event.title : undefined}>
                            {calendarEventLabel(event, day.date)}
                          </Link>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-blue-100 bg-blue-50/45 shadow-sm">
            <div className="h-1 bg-amber-400" />
            <CardHeader>
              <CardTitle>Upcoming</CardTitle>
              <CardDescription>Published services and events</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {upcoming.map((event) => <EventListItem key={`${event.id}-${eventStart(event)}`} event={event} href={`/member/services/${event.id}`} />)}
              </div>
              {!upcoming.length && <p className="py-8 text-center text-sm text-muted-foreground">No upcoming events.</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </MemberLayout>
  );
}

function MemberEventDetail({ eventId }: { eventId: number }) {
  const eventQuery = useQuery({
    queryKey: ["member-event", eventId],
    queryFn: () => apiJson<{ event: ChurchEvent }>(`/events/${eventId}`),
  });
  const event = eventQuery.data?.event;

  return (
    <MemberLayout>
      <div className="mx-auto max-w-5xl space-y-6">
        <Button variant="ghost" className="w-fit px-0" asChild>
          <Link href="/member/services"><ArrowLeft className="mr-2 h-4 w-4" />Services & Events</Link>
        </Button>
        {event ? (
          <Card className="overflow-hidden border-blue-100 bg-blue-50/45 shadow-sm">
            <div className="h-1 bg-blue-500" />
            {event.posterUrl && <img src={event.posterUrl} alt="" className="h-64 w-full object-cover" />}
            <CardHeader>
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle className="text-3xl">{event.title}</CardTitle>
                  <CardDescription className="mt-2">{formatDateTimeRange(event)}</CardDescription>
                </div>
                <EventBadges event={event} />
              </div>
            </CardHeader>
            <CardContent className="grid gap-6 lg:grid-cols-[1fr_280px]">
              <div className="space-y-4">
                <p className="text-sm leading-6 text-muted-foreground">{event.description ?? "No description provided."}</p>
                <div className="flex flex-wrap gap-2">
                  {event.zoomLink && <Button asChild variant="outline"><a href={event.zoomLink} target="_blank" rel="noreferrer">Join Zoom <ExternalLink className="ml-2 h-4 w-4" /></a></Button>}
                  {event.youtubeLink && <Button asChild variant="outline"><a href={event.youtubeLink} target="_blank" rel="noreferrer">Watch YouTube <ExternalLink className="ml-2 h-4 w-4" /></a></Button>}
                </div>
              </div>
              <div className="rounded-md border border-blue-100 bg-white/75 p-4 text-sm">
                <p className="font-medium">Location</p>
                <p className="mt-1 text-muted-foreground">{event.location ?? "Not set"}</p>
                <p className="mt-4 font-medium">Mode</p>
                <p className="mt-1 text-muted-foreground">{labelize(event.eventMode)}</p>
                <p className="mt-4 font-medium">Created</p>
                <p className="mt-1 text-muted-foreground">{formatDate(event.createdAt)}</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-blue-100 bg-blue-50/45"><CardContent className="py-12 text-center text-muted-foreground">{eventQuery.isLoading ? "Loading event..." : "Event not found."}</CardContent></Card>
        )}
      </div>
    </MemberLayout>
  );
}

function EventListItem({ event, href }: { event: ChurchEvent; href: string }) {
  return (
    <div className="rounded-lg border border-blue-100 bg-white/75 p-3 transition-colors hover:bg-blue-50/60">
      <div className="flex gap-3">
        {event.posterUrl ? <img src={event.posterUrl} alt="" className="h-16 w-20 rounded-md object-cover" /> : null}
        <div className="min-w-0 flex-1">
          <p className="font-medium">{event.title}</p>
          <p className="text-sm text-muted-foreground">{formatDateTimeRange(event)}</p>
          <div className="mt-2"><EventBadges event={event} /></div>
        </div>
      </div>
      <Button asChild variant="outline" size="sm" className="mt-3 w-full bg-white/80"><Link href={href}>View Details</Link></Button>
    </div>
  );
}

function calendarEventClass(event: ChurchEvent, day: Date) {
  const colors = eventTypeCalendarClasses(event.eventType);
  if (!isMultiDayEvent(event)) return `block rounded px-2 py-1 text-xs ${colors.single}`;
  const position = spanPosition(event, day);
  const shape = position === "start"
    ? "rounded-l-md rounded-r-none"
    : position === "end"
    ? "rounded-r-md rounded-l-none"
    : position === "middle"
    ? "rounded-none"
    : "rounded-md";
  return `-mx-2 block ${shape} px-2 py-1 text-xs font-medium ${colors.span}`;
}

function calendarEventLabel(event: ChurchEvent, day: Date) {
  if (!isMultiDayEvent(event)) return `${formatTime(eventStart(event))} ${event.title}`;
  return shouldShowSpanLabel(event, day) ? event.title : "\u00a0";
}

function calendarDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return { key: date.toISOString(), date, inMonth: date.getMonth() === month.getMonth() };
  });
}
