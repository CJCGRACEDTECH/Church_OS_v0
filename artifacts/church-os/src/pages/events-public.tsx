import React from "react";
import { PublicLayout } from "@/components/PublicLayout";
import { Link } from "wouter";
import { Calendar, MapPin, Clock, ArrowRight, Video } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

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

function formatEventDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatEventTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function eventTypeLabel(type: string) {
  const labels: Record<string, string> = {
    service: "Service",
    discipleship: "Discipleship",
    bible_study: "Bible Study",
    prayer: "Prayer",
    baptism: "Baptism",
    fasting_season: "Fasting",
    special_event: "Special Event",
    announcement: "Announcement",
  };
  return labels[type] ?? type;
}

function EventCard({ event }: { event: PublicEvent }) {
  const isOnline = event.eventMode === "online";

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
      {event.posterUrl && (
        <img src={event.posterUrl} alt={event.title} className="w-full h-40 object-cover" />
      )}
      <div className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <span
            className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full"
            style={{ background: "#eff6ff", color: "#2563eb" }}
          >
            {eventTypeLabel(event.eventType)}
          </span>
          {isOnline && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-700">
              <Video className="h-3 w-3" /> Online
            </span>
          )}
        </div>
        <h3 className="font-bold text-gray-900 text-base mb-2 leading-snug">{event.title}</h3>
        {event.description && (
          <p className="text-sm text-gray-500 leading-relaxed mb-3 line-clamp-2">{event.description}</p>
        )}
        <div className="space-y-1.5 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
            <span>{formatEventDate(event.startDatetime)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
            <span>
              {formatEventTime(event.startDatetime)} – {formatEventTime(event.endDatetime)}
            </span>
          </div>
          {event.location && (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
              <span>{event.location}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="py-20 text-center">
      <div
        className="h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-5 text-3xl"
        style={{ background: "#eff6ff" }}
      >
        📅
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">No Upcoming Events</h2>
      <p className="text-gray-500 text-sm max-w-sm mx-auto leading-relaxed mb-6">
        Check back soon — new events will appear here. In the meantime, join us for our regular services.
      </p>
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <div className="bg-gray-50 rounded-xl border border-gray-100 px-6 py-4 text-sm text-gray-700 max-w-xs text-left">
          <p className="font-semibold text-gray-900 mb-2">Regular Services</p>
          <div className="space-y-1 text-gray-500">
            <p>Thursday &amp; Friday — 7:00 PM</p>
            <p>Saturday — 6:00 PM</p>
            <p>Sunday — 11:00 AM</p>
          </div>
          <p className="mt-2 text-xs text-gray-400">7403 Boston Blvd, Springfield, VA</p>
        </div>
      </div>
    </div>
  );
}

export default function EventsPublicPage() {
  const [events, setEvents] = React.useState<PublicEvent[]>([]);
  const [status, setStatus] = React.useState<"loading" | "done" | "error">("loading");

  React.useEffect(() => {
    fetch(`${basePath}/api/public/events`)
      .then((r) => r.json())
      .then((data) => {
        setEvents(Array.isArray(data.events) ? data.events : []);
        setStatus("done");
      })
      .catch(() => {
        setEvents([]);
        setStatus("done");
      });
  }, []);

  return (
    <PublicLayout>
      {/* Header */}
      <section className="py-16 px-4 text-center" style={{ background: "#181d2e" }}>
        <p className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-4">What's On</p>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Events</h1>
        <p className="text-gray-400 max-w-md mx-auto text-sm leading-relaxed">
          Upcoming services, events, and special gatherings at CJC Church.
        </p>
      </section>

      {/* Regular Services Strip */}
      <section className="border-b border-gray-100 bg-white py-5 px-4">
        <div className="mx-auto max-w-4xl flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 text-sm">
          <div className="flex items-center gap-2 text-gray-700">
            <Clock className="h-4 w-4 text-blue-500" />
            <span className="font-semibold">Regular Services:</span>
          </div>
          <span className="text-gray-600">Thursday &amp; Friday — 7:00 PM</span>
          <span className="hidden md:block text-gray-300">|</span>
          <span className="text-gray-600">Saturday — 6:00 PM</span>
          <span className="hidden md:block text-gray-300">|</span>
          <span className="text-gray-600">Sunday — 11:00 AM</span>
          <span className="hidden md:block text-gray-300">|</span>
          <div className="flex items-center gap-1 text-gray-600">
            <MapPin className="h-3.5 w-3.5 text-blue-500" />
            7403 Boston Blvd, Springfield, VA
          </div>
        </div>
      </section>

      {/* Events */}
      <section className="py-12 px-4 bg-gray-50 min-h-96">
        <div className="mx-auto max-w-5xl">
          {status === "loading" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 animate-pulse">
                  <div className="h-4 bg-gray-100 rounded w-20 mb-3" />
                  <div className="h-5 bg-gray-100 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-gray-100 rounded w-full mb-1" />
                  <div className="h-3 bg-gray-100 rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : events.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <div className="flex items-center gap-2 mb-8">
                <div className="h-1 w-8 rounded" style={{ background: "#2563eb" }} />
                <h2 className="text-lg font-bold text-gray-900">Upcoming Events</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {events.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="py-14 px-4" style={{ background: "#181d2e" }}>
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Come As You Are</h2>
          <p className="text-gray-400 text-sm leading-relaxed mb-6">
            All are welcome at CJC Church. Whether you're visiting for the first time or returning home,
            there's a seat for you.
          </p>
          <Link
            href="/connect"
            className="inline-flex items-center gap-2 px-7 py-3 text-white font-semibold rounded-lg transition-colors"
            style={{ background: "#2563eb" }}
          >
            Connect With Us <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
