import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiJson, eventStart, formatDateTimeRange, labelize, type ChurchEvent } from "@/lib/events";
import { CalendarDays, Video } from "lucide-react";

export default function EventsFeed({ detailBasePath }: { detailBasePath: string }) {
  const eventsQuery = useQuery({
    queryKey: ["dashboard-events-feed", detailBasePath],
    queryFn: () => apiJson<{ events: ChurchEvent[] }>("/events?limit=5"),
  });
  const events = eventsQuery.data?.events ?? [];
  const nextEvent = events[0];

  return (
    <Card className="overflow-hidden border-blue-100 bg-blue-50/45 shadow-sm">
      <div className="h-1 bg-blue-500" />
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-100 text-blue-700">
            <CalendarDays className="h-4 w-4" />
          </span>
          Upcoming Services & Events
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {nextEvent && (
          <div className="rounded-md border border-blue-100 bg-white/75 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Next Up</p>
            <div className="mt-2 flex items-start gap-3">
              {nextEvent.posterUrl ? <img src={nextEvent.posterUrl} alt="" className="h-16 w-20 rounded-md object-cover" /> : null}
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{nextEvent.title}</p>
                <p className="text-sm text-muted-foreground">{formatDateTimeRange(nextEvent)}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="outline" className="border-amber-200 bg-white text-amber-800">{labelize(nextEvent.eventType)}</Badge>
                  {nextEvent.eventMode !== "in_person" && <Badge variant="outline"><Video className="mr-1 h-3 w-3" />{labelize(nextEvent.eventMode)}</Badge>}
                  {nextEvent.status === "cancelled" && <Badge variant="destructive">Cancelled</Badge>}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {events.slice(0, 4).map((event) => (
            <div key={`${event.id}-${eventStart(event)}`} className="flex items-center justify-between gap-3 rounded-md border border-blue-100 bg-white/75 p-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{event.title}</p>
                <p className="text-sm text-muted-foreground">{formatDateTimeRange(event)}</p>
              </div>
              <Button asChild variant="outline" size="sm" className="bg-white/80">
                <Link href={`${detailBasePath}/${event.id}`}>View Details</Link>
              </Button>
            </div>
          ))}
          {!events.length && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {eventsQuery.isLoading ? "Loading upcoming events..." : "No upcoming services or events."}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
