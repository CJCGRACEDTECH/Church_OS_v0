import React from "react";
import { Link, useLocation, useRoute } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/AdminLayout";
import EventForm from "@/components/EventForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
} from "@/lib/events";
import { ArrowLeft, CalendarDays, ExternalLink, Pencil, Plus, Search, Trash2, Video } from "lucide-react";

function EventBadges({ event }: { event: ChurchEvent }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge variant="secondary">{labelize(event.eventType)}</Badge>
      {event.isRecurring && <Badge variant="outline">Weekly</Badge>}
      {event.eventMode !== "in_person" && <Badge variant="outline"><Video className="mr-1 h-3 w-3" />{labelize(event.eventMode)}</Badge>}
      {event.youtubeLink && <Badge variant="outline">YouTube</Badge>}
      {event.status === "draft" && <Badge variant="outline">Draft</Badge>}
      {event.status === "cancelled" && <Badge variant="destructive">Cancelled</Badge>}
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
    queryFn: () => apiJson<{ events: ChurchEvent[] }>("/admin/events?limit=10"),
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
  const days = calendarDays(month);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Ministry Calendar</p>
            <h1 className="text-3xl font-semibold tracking-tight">Services & Events</h1>
          </div>
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
        </div>

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
                {days.map((day) => {
                  const dayEvents = events.filter((event) => eventSpansDay(event, day.date));
                  return (
                    <div key={day.key} className={`min-h-28 border-b border-r p-2 ${day.inMonth ? "bg-background" : "bg-muted/20 text-muted-foreground"}`}>
                      <p className="text-xs font-medium">{day.date.getDate()}</p>
                      <div className="mt-2 space-y-1">
                        {dayEvents.slice(0, 3).map((event) => (
                          <Link key={`${event.id}-${eventStart(event)}-${day.key}`} href={`/admin/services/${event.id}`} className={calendarEventClass(event, day.date)} title={shouldShowSpanLabel(event, day.date) ? event.title : undefined}>
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

          <Card>
            <CardHeader>
              <CardTitle>Upcoming</CardTitle>
              <CardDescription>Next services and events</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {upcoming.map((event) => <EventListItem key={`${event.id}-${eventStart(event)}`} event={event} href={`/admin/services/${event.id}`} />)}
              </div>
              {!upcoming.length && <p className="py-8 text-center text-sm text-muted-foreground">No upcoming events.</p>}
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
    },
    onError: (error) => toast({ title: "Could not update event", description: error.message, variant: "destructive" }),
  });

  const deleteEvent = useMutation({
    mutationFn: () => apiJson<{ ok: true }>(`/admin/events/${eventId}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Event deleted" });
      void queryClient.invalidateQueries({ queryKey: ["admin-events"] });
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
            <div className="flex gap-2">
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
              <Button variant="destructive" onClick={() => deleteEvent.mutate()} disabled={deleteEvent.isPending}><Trash2 className="mr-2 h-4 w-4" />Delete</Button>
            </div>
          )}
        </div>
        {event ? <EventDetailCard event={event} /> : <Card><CardContent className="py-12 text-center text-muted-foreground">{eventQuery.isLoading ? "Loading event..." : "Event not found."}</CardContent></Card>}
      </div>
    </AdminLayout>
  );
}

function EventDetailCard({ event }: { event: ChurchEvent }) {
  return (
    <Card className="overflow-hidden">
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
            {event.zoomLink && <Button asChild variant="outline"><a href={event.zoomLink} target="_blank" rel="noreferrer">Zoom <ExternalLink className="ml-2 h-4 w-4" /></a></Button>}
            {event.youtubeLink && <Button asChild variant="outline"><a href={event.youtubeLink} target="_blank" rel="noreferrer">YouTube <ExternalLink className="ml-2 h-4 w-4" /></a></Button>}
          </div>
        </div>
        <div className="rounded-md border p-4 text-sm">
          <p className="font-medium">Location</p>
          <p className="mt-1 text-muted-foreground">{event.location ?? "Not set"}</p>
          <p className="mt-4 font-medium">Mode</p>
          <p className="mt-1 text-muted-foreground">{labelize(event.eventMode)}</p>
          <p className="mt-4 font-medium">Created</p>
          <p className="mt-1 text-muted-foreground">{formatDate(event.createdAt)}</p>
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
          <p className="font-medium">{event.title}</p>
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
