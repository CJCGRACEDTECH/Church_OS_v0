import React from "react";
import { Link } from "wouter";
import { CalendarDays, Clock, Globe, MapPin, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type PublicEvent = {
  id: number;
  title: string;
  eventType: string;
  description: string | null;
  startDatetime: string;
  endDatetime: string;
  location: string | null;
  eventMode: string;
  posterUrl: string | null;
};

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

async function fetchPublicEvents(): Promise<PublicEvent[]> {
  const response = await fetch(`${basePath}/api/public/events`);
  if (!response.ok) return [];
  const data = await response.json().catch(() => ({ events: [] }));
  return Array.isArray(data.events) ? (data.events as PublicEvent[]) : [];
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function formatDateTimeRange(start: string, end: string) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const sameDay = startDate.toDateString() === endDate.toDateString();
  return sameDay
    ? `${formatDate(start)} · ${formatTime(start)} – ${formatTime(end)}`
    : `${formatDate(start)} – ${formatDate(end)}`;
}

function eventTypeLabel(type: string) {
  return type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  service: "bg-indigo-100 text-indigo-800 border-indigo-200",
  discipleship: "bg-emerald-100 text-emerald-800 border-emerald-200",
  bible_study: "bg-sky-100 text-sky-800 border-sky-200",
  prayer: "bg-violet-100 text-violet-800 border-violet-200",
  baptism: "bg-cyan-100 text-cyan-800 border-cyan-200",
  fasting_season: "bg-amber-100 text-amber-800 border-amber-200",
  special_event: "bg-rose-100 text-rose-800 border-rose-200",
  announcement: "bg-slate-100 text-slate-700 border-slate-200",
};

function EventCard({ event }: { event: PublicEvent }) {
  const typeColor = EVENT_TYPE_COLORS[event.eventType] ?? "bg-muted text-muted-foreground";

  return (
    <Card className="overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {event.posterUrl && (
        <img src={event.posterUrl} alt="" className="h-44 w-full object-cover" />
      )}
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-xl leading-tight">{event.title}</CardTitle>
          <span className={`shrink-0 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${typeColor}`}>
            {eventTypeLabel(event.eventType)}
          </span>
        </div>
        <CardDescription className="flex items-center gap-1.5 text-sm font-medium text-indigo-700">
          <CalendarDays className="h-3.5 w-3.5 shrink-0" />
          {formatDateTimeRange(event.startDatetime, event.endDatetime)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {event.description && (
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">{event.description}</p>
        )}
        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
          {event.location && (
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {event.location}
            </span>
          )}
          {event.eventMode !== "in_person" && (
            <span className="flex items-center gap-1.5">
              <Video className="h-3.5 w-3.5 shrink-0" />
              {event.eventMode === "online" ? "Online" : "Hybrid"}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function EventCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </CardContent>
    </Card>
  );
}

export default function PublicEventsPage() {
  const [events, setEvents] = React.useState<PublicEvent[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setIsLoading(true);
    fetchPublicEvents()
      .then((data) => {
        setEvents(data);
        setError(null);
      })
      .catch(() => {
        setError("Events could not be loaded. Please try again later.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const upcoming = events.filter((e) => new Date(e.endDatetime) >= new Date());

  return (
    <main className="min-h-screen bg-[#eef0f8]">
      <header className="border-b border-white/10 bg-[#181d2e]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/sign-in" className="flex items-center gap-3">
            <img src={`${basePath}/cjc-logo.webp`} alt="CJC Church" className="h-10 w-auto" style={{ mixBlendMode: "screen" }} />
            <span className="font-semibold text-white">CJC Church</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/connect" className="text-sm text-gray-300 hover:text-white transition-colors">
              Connect
            </Link>
            <Link href="/sign-in" className="text-sm border border-white/20 rounded-md px-4 py-1.5 text-white hover:bg-white/10 transition-colors">
              Login
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="h-5 w-5 text-indigo-600" />
            <span className="text-sm font-medium text-indigo-600 uppercase tracking-wide">What's Happening</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">Upcoming Events</h1>
          <p className="mt-2 text-gray-500">Join us for worship, community, and growth.</p>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => <EventCardSkeleton key={i} />)}
          </div>
        ) : upcoming.length === 0 && !error ? (
          <div className="rounded-xl border border-dashed bg-white/60 py-16 text-center">
            <CalendarDays className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="mt-4 text-lg font-medium text-gray-700">No upcoming events</p>
            <p className="mt-1 text-sm text-muted-foreground">Check back soon for new events.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((event) => <EventCard key={event.id} event={event} />)}
          </div>
        )}

        <div className="mt-12 flex flex-col items-center gap-3 border-t pt-8 text-center text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            <span>All times are local to the church.</span>
          </div>
          <p>
            Want to stay connected?{" "}
            <Link href="/connect" className="font-medium text-indigo-600 hover:underline">
              Fill out a connect card →
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
