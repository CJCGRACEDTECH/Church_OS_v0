import React from "react";
import { Link, useLocation, useRoute } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/AdminLayout";
import PageHeader from "@/components/PageHeader";
import EventForm from "@/components/EventForm";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  apiJson,
  defaultMonthRange,
  emptyEventForm,
  eventTypeCalendarClasses,
  eventSpansDay,
  eventStart,
  formatDate,
  formatDateTimeRange,
  formatTime,
  formFromEvent,
  isMultiDayEvent,
  labelize,
  payloadFromEventForm,
  shouldShowSpanLabel,
  spanPosition,
  type ChurchEvent,
  type EventFormState,
  type EventType,
} from "@/lib/events";
import { ArrowLeft, Ban, CalendarDays, ExternalLink, Globe, GlobeLock, Pencil, Plus, Search, Trash2, Video } from "lucide-react";

const EVENT_TYPE_BADGE_CLASSES: Record<EventType, string> = {
  service: "bg-indigo-100 text-indigo-800 border-indigo-200",
  discipleship: "bg-emerald-100 text-emerald-800 border-emerald-200",
  bible_study: "bg-sky-100 text-sky-800 border-sky-200",
  prayer: "bg-violet-100 text-violet-800 border-violet-200",
  baptism: "bg-cyan-100 text-cyan-800 border-cyan-200",
  fasting_season: "bg-white text-amber-800 border-amber-200",
  special_event: "bg-rose-100 text-rose-800 border-rose-200",
  announcement: "bg-slate-100 text-slate-700 border-slate-200",
};

function EventTypeBadge({ eventType }: { eventType: EventType }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${EVENT_TYPE_BADGE_CLASSES[eventType] ?? "bg-muted text-muted-foreground"}`}>
      {labelize(eventType)}
    </span>
  );
}

function EventStatusBadge({ status }: { status: ChurchEvent["status"] }) {
  if (status === "published") return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border border-emerald-200">Published</Badge>;
  if (status === "cancelled") return <Badge variant="destructive">Cancelled</Badge>;
  return <Badge variant="outline">Draft</Badge>;
}

function EventBadges({ event }: { event: ChurchEvent }) {
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <EventTypeBadge eventType={event.eventType} />
      <EventStatusBadge status={event.status} />
      {event.isRecurring && <Badge variant="outline">Weekly</Badge>}
      {event.eventMode !== "in_person" && <Badge variant="outline"><Video className="mr-1 h-3 w-3" />{labelize(event.eventMode)}</Badge>}
      {event.visibility === "admin_only" && <Badge variant="outline">Admins Only</Badge>}
    </div>
  );
}

export default function AdminServices() {
  const [, params] = useRoute("/admin/services/:id");
  return params?.id ? <AdminEventDetail eventId={Number(params.id)} /> : <AdminServicesCalendar />;
}

function AdminServicesCalendar() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [search, setSearch] = React.useState("");
  const [eventType, setEventType] = React.useState("");
  const [month, setMonth] = React.useState(new Date());
  const [createOpen, setCreateOpen] = React.useState(false);
  const [showAll, setShowAll] = React.useState(false);
  const [form, setForm] = React.useState<EventFormState>(() => {
    const start = new Date();
    start.setDate(start.getDate() + 1);
    start.setHours(19, 0, 0, 0);
    const end = new Date(start);
    end.setHours(21, 0, 0, 0);
    return { ...emptyEventForm, startDate: start.toISOString().slice(0, 10), startTime: "19:00", endDate: end.toISOString().slice(0, 10), endTime: "21:00", status: "published" };
  });

  const range = React.useMemo(() => defaultMonthRange(month), [month]);
  const eventsQuery = useQuery({
    queryKey: ["admin-events", search, eventType, range.start, range.end],
    queryFn: () => {
      const params = new URLSearchParams({ start: range.start, end: range.end, limit: "250" });
      if (search.trim()) params.set("search", search.trim());
      if (eventType) params.set("eventType", eventType);
      return apiJson<{ events: ChurchEvent[] }>(`/admin/events?${params}`);
    },
  });

  const upcomingQuery = useQuery({
    queryKey: ["admin-upcoming-events"],
    queryFn: () => apiJson<{ events: ChurchEvent[] }>("/admin/events?limit=50"),
  });

  const createEvent = useMutation({
    mutationFn: () => apiJson<{ event: ChurchEvent }>("/admin/events", { method: "POST", body: JSON.stringify(payloadFromEventForm(form)) }),
    onSuccess: (data) => {
      setCreateOpen(false);
      toast({ title: "Event created" });
      void queryClient.invalidateQueries({ queryKey: ["admin-events"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-upcoming-events"] });
      setLocation(`/admin/services/${data.event.id}`);
    },
    onError: (error) => toast({ title: "Could not create event", description: error.message, variant: "destructive" }),
  });

  const events = eventsQuery.data?.events ?? [];
  const upcoming = upcomingQuery.data?.events ?? [];
  const visibleUpcoming = showAll ? upcoming : upcoming.slice(0, 20);
  const days = calendarDays(month);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Ministry Calendar"
          title="Services & Events"
          description="Schedule and manage recurring services and one-time events."
          icon={<CalendarDays className="h-6 w-6" />}
          actions={
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" />Create Event</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create Event</DialogTitle>
                  <DialogDescription>Create one-time events or recurring weekly services.</DialogDescription>
                </DialogHeader>
                <EventForm form={form} setForm={setForm} onSubmit={() => createEvent.mutate()} submitLabel="Create Event" isSubmitting={createEvent.isPending} />
              </DialogContent>
            </Dialog>
          }
        />

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5" /> Calendar</CardTitle>
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
              <div className="grid grid-cols-7 overflow-hidden rounded-md border">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div key={day} className="border-b bg-muted/40 p-2 text-center text-xs font-medium text-muted-foreground">{day}</div>
                ))}
                {eventsQuery.isLoading
                  ? Array.from({ length: 42 }, (_, index) => (
                      <div key={index} className="min-h-28 border-b border-r p-2">
                        <Skeleton className="h-3 w-4 mb-2" />
                        {index % 3 === 0 && <Skeleton className="h-5 w-full rounded" />}
                        {index % 5 === 0 && <Skeleton className="mt-1 h-5 w-4/5 rounded" />}
                      </div>
                    ))
                  : days.map((day) => {
                      const dayEvents = events.filter((e) => eventSpansDay(e, day.date));
                      return (
                        <div key={day.key} className={`min-h-28 border-b border-r p-2 ${day.inMonth ? "bg-background" : "bg-muted/20 text-muted-foreground"}`}>
                          <p className="text-xs font-medium">{day.date.getDate()}</p>
                          <div className="mt-2 space-y-1">
                            {dayEvents.slice(0, 3).map((e) => (
                              <Link key={`${e.id}-${eventStart(e)}-${day.key}`} href={`/admin/services/${e.id}`} className={calendarEventClass(e, day.date)} title={shouldShowSpanLabel(e, day.date) ? e.title : undefined}>
                                {calendarEventLabel(e, day.date)}
                              </Link>
                            ))}
                            {dayEvents.length > 3 && <p className="text-xs text-muted-foreground pl-1">+{dayEvents.length - 3} more</p>}
                          </div>
                        </div>
                      );
                    })
                }
              </div>
              {!eventsQuery.isLoading && events.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No events this month —{" "}
                  <button className="underline hover:text-foreground" onClick={() => setCreateOpen(true)}>create one</button>
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Upcoming</CardTitle>
              <CardDescription>Next services and events</CardDescription>
            </CardHeader>
            <CardContent>
              {upcomingQuery.isLoading ? (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 3 }, (_, index) => (
                    <div key={index} className="rounded-md border p-3 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                      <Skeleton className="h-5 w-24 rounded-full" />
                    </div>
                  ))}
                </div>
              ) : upcoming.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No upcoming events.</p>
              ) : (
                <>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {visibleUpcoming.map((e) => <EventListItem key={`${e.id}-${eventStart(e)}`} event={e} href={`/admin/services/${e.id}`} />)}
                  </div>
                  {upcoming.length > 20 && !showAll && (
                    <div className="mt-4 text-center">
                      <Button variant="outline" size="sm" onClick={() => setShowAll(true)}>
                        Load more ({upcoming.length - 20} remaining)
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}

function AdminEventDetail({ eventId }: { eventId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [form, setForm] = React.useState<EventFormState>(emptyEventForm);

  const eventQuery = useQuery({
    queryKey: ["admin-event", eventId],
    queryFn: () => apiJson<{ event: ChurchEvent }>(`/admin/events/${eventId}`),
  });
  const event = eventQuery.data?.event;

  React.useEffect(() => {
    if (event) setForm(formFromEvent(event));
  }, [event]);

  const updateEvent = useMutation({
    mutationFn: () => apiJson<{ event: ChurchEvent }>(`/admin/events/${eventId}`, { method: "PATCH", body: JSON.stringify(payloadFromEventForm(form)) }),
    onSuccess: () => {
      setEditOpen(false);
      toast({ title: "Event updated" });
      void queryClient.invalidateQueries({ queryKey: ["admin-event", eventId] });
      void queryClient.invalidateQueries({ queryKey: ["admin-events"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-upcoming-events"] });
    },
    onError: (error) => toast({ title: "Could not update event", description: error.message, variant: "destructive" }),
  });

  const cancelEvent = useMutation({
    mutationFn: () => {
      if (!event) throw new Error("No event loaded");
      return apiJson<{ event: ChurchEvent }>(`/admin/events/${eventId}`, {
        method: "PATCH",
        body: JSON.stringify({ ...payloadFromEventForm(formFromEvent(event)), status: "cancelled" }),
      });
    },
    onSuccess: () => {
      toast({ title: "Event cancelled" });
      void queryClient.invalidateQueries({ queryKey: ["admin-event", eventId] });
      void queryClient.invalidateQueries({ queryKey: ["admin-events"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-upcoming-events"] });
    },
    onError: (error) => toast({ title: "Could not cancel event", description: error.message, variant: "destructive" }),
  });

  const publishToWebsite = useMutation({
    mutationFn: () => {
      if (!event) throw new Error("No event loaded");
      return apiJson<{ event: ChurchEvent }>(`/admin/events/${eventId}`, {
        method: "PATCH",
        body: JSON.stringify({ ...payloadFromEventForm(formFromEvent(event)), status: "published", visibility: "public" }),
      });
    },
    onSuccess: () => {
      toast({ title: "Event published to public website" });
      void queryClient.invalidateQueries({ queryKey: ["admin-event", eventId] });
      void queryClient.invalidateQueries({ queryKey: ["admin-events"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-upcoming-events"] });
    },
    onError: (error) => toast({ title: "Could not publish event", description: error.message, variant: "destructive" }),
  });

  const unpublishFromWebsite = useMutation({
    mutationFn: () => {
      if (!event) throw new Error("No event loaded");
      return apiJson<{ event: ChurchEvent }>(`/admin/events/${eventId}`, {
        method: "PATCH",
        body: JSON.stringify({ ...payloadFromEventForm(formFromEvent(event)), status: "draft", visibility: "admin_only" }),
      });
    },
    onSuccess: () => {
      toast({ title: "Event removed from public website" });
      void queryClient.invalidateQueries({ queryKey: ["admin-event", eventId] });
      void queryClient.invalidateQueries({ queryKey: ["admin-events"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-upcoming-events"] });
    },
    onError: (error) => toast({ title: "Could not unpublish event", description: error.message, variant: "destructive" }),
  });

  const deleteEvent = useMutation({
    mutationFn: () => apiJson<{ ok: true }>(`/admin/events/${eventId}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Event deleted" });
      void queryClient.invalidateQueries({ queryKey: ["admin-events"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-upcoming-events"] });
      setLocation("/admin/services");
    },
    onError: (error) => toast({ title: "Could not delete event", description: error.message, variant: "destructive" }),
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <Button variant="ghost" className="w-fit px-0" asChild>
            <Link href="/admin/services"><ArrowLeft className="mr-2 h-4 w-4" />Services & Events</Link>
          </Button>
          {event && (
            <div className="flex flex-wrap gap-2">
              <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline"><Pencil className="mr-2 h-4 w-4" />Edit</Button>
                </DialogTrigger>
                <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Edit Event</DialogTitle>
                    <DialogDescription>Update event details, links, poster, status, and recurrence.</DialogDescription>
                  </DialogHeader>
                  <EventForm form={form} setForm={setForm} onSubmit={() => updateEvent.mutate()} submitLabel="Save Changes" isSubmitting={updateEvent.isPending} />
                </DialogContent>
              </Dialog>
              {event.status !== "cancelled" && event.status !== "published" && event.visibility !== "public" && (
                <Button
                  variant="outline"
                  className="border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-50"
                  onClick={() => publishToWebsite.mutate()}
                  disabled={publishToWebsite.isPending}
                >
                  <Globe className="mr-2 h-4 w-4" />Publish to Website
                </Button>
              )}
              {event.status === "published" && event.visibility === "public" && (
                <Button
                  variant="outline"
                  className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  onClick={() => unpublishFromWebsite.mutate()}
                  disabled={unpublishFromWebsite.isPending}
                >
                  <GlobeLock className="mr-2 h-4 w-4" />Unpublish
                </Button>
              )}
              {event.status !== "cancelled" && (
                <Button
                  variant="outline"
                  className="border-amber-300 bg-white text-amber-800 hover:bg-amber-50"
                  onClick={() => cancelEvent.mutate()}
                  disabled={cancelEvent.isPending}
                >
                  <Ban className="mr-2 h-4 w-4" />Cancel Event
                </Button>
              )}
              <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="mr-2 h-4 w-4" />Delete
              </Button>
            </div>
          )}
        </div>

        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete "{event?.title}"?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove the event and all its data. This cannot be undone.
                {event?.isRecurring && " Note: this deletes the event definition and all future occurrences."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep Event</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deleteEvent.mutate()}
              >
                Delete Permanently
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {event ? (
          <EventDetailCard event={event} />
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              {eventQuery.isLoading ? "Loading event..." : "Event not found."}
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatTime12(value: string | null | undefined): string {
  if (!value) return "—";
  const [hourString, minuteString] = value.split(":");
  const hour = Number(hourString);
  const minute = Number(minuteString ?? "0");
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value;
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function EventDetailCard({ event }: { event: ChurchEvent }) {
  return (
    <Card className="overflow-hidden">
      {event.posterUrl && <img src={event.posterUrl} alt="" className="h-64 w-full object-cover" />}
      <CardHeader>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle className={`text-3xl ${event.status === "cancelled" ? "line-through text-muted-foreground" : ""}`}>
              {event.title}
            </CardTitle>
            <CardDescription className="mt-2">{formatDateTimeRange(event)}</CardDescription>
          </div>
          <EventBadges event={event} />
        </div>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          <p className="text-sm leading-6 text-muted-foreground">{event.description ?? "No description provided."}</p>
          {event.isRecurring && (
            <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              Recurring weekly — every {WEEKDAYS[event.recurrenceDay ?? 0] ?? "?"} at {formatTime12(event.recurrenceTime)}
            </p>
          )}
          {(event.zoomLink || event.youtubeLink) && (
            <div className="flex flex-wrap gap-2">
              {event.zoomLink && <Button asChild variant="outline"><a href={event.zoomLink} target="_blank" rel="noreferrer">Zoom <ExternalLink className="ml-2 h-4 w-4" /></a></Button>}
              {event.youtubeLink && <Button asChild variant="outline"><a href={event.youtubeLink} target="_blank" rel="noreferrer">YouTube <ExternalLink className="ml-2 h-4 w-4" /></a></Button>}
            </div>
          )}
        </div>
        <div className="rounded-md border p-4 text-sm space-y-4">
          <div>
            <p className="font-medium">Location</p>
            <p className="mt-1 text-muted-foreground">{event.location ?? "Not set"}</p>
          </div>
          <div>
            <p className="font-medium">Mode</p>
            <p className="mt-1 text-muted-foreground">{labelize(event.eventMode)}</p>
          </div>
          <div>
            <p className="font-medium">Visibility</p>
            <p className="mt-1 text-muted-foreground">{labelize(event.visibility)}</p>
          </div>
          {(event.linkedSessionCount ?? 0) > 0 && (
            <div>
              <p className="font-medium">Attendance</p>
              <p className="mt-1 text-muted-foreground">
                {event.linkedAttendanceCount ?? 0} present across {event.linkedSessionCount} session{event.linkedSessionCount === 1 ? "" : "s"}
              </p>
            </div>
          )}
          <div>
            <p className="font-medium">Created</p>
            <p className="mt-1 text-muted-foreground">{formatDate(event.createdAt)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EventListItem({ event, href }: { event: ChurchEvent; href: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="flex gap-3">
        {event.posterUrl ? <img src={event.posterUrl} alt="" className="h-16 w-20 rounded-md object-cover" /> : null}
        <div className="min-w-0 flex-1">
          <p className={`font-medium truncate ${event.status === "cancelled" ? "line-through text-muted-foreground" : ""}`}>{event.title}</p>
          <p className="text-sm text-muted-foreground">{formatDateTimeRange(event)}</p>
          <div className="mt-2"><EventBadges event={event} /></div>
        </div>
      </div>
      <Button asChild variant="outline" size="sm" className="mt-3 w-full"><Link href={href}>View Details</Link></Button>
    </div>
  );
}

function calendarEventClass(event: ChurchEvent, day: Date) {
  const colors = eventTypeCalendarClasses(event.eventType);
  const cancelled = event.status === "cancelled" ? "opacity-50" : "";
  if (!isMultiDayEvent(event)) return `block rounded px-2 py-1 text-xs ${colors.single} ${cancelled}`;
  const position = spanPosition(event, day);
  const shape = position === "start"
    ? "rounded-l-md rounded-r-none"
    : position === "end"
    ? "rounded-r-md rounded-l-none"
    : position === "middle"
    ? "rounded-none"
    : "rounded-md";
  return `-mx-2 block ${shape} px-2 py-1 text-xs font-medium ${colors.span} ${cancelled}`;
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
