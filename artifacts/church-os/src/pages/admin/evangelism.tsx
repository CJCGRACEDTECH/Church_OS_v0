import React from "react";
import { Link, useLocation, useRoute } from "wouter";
import { QRCodeSVG } from "qrcode.react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/AdminLayout";
import PageHeader from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CalendarDays, Copy, Download, ExternalLink, Megaphone, Plus, Printer, Search, UsersRound } from "lucide-react";

type OutreachEvent = {
  id: number;
  eventName: string;
  eventDate: string;
  location: string | null;
  notes: string | null;
  publicToken: string;
  publicContactPath: string;
  evangelistQrPath: string;
  totalContacts: number;
  createdAt: string;
  updatedAt: string;
};

type OutreachContact = {
  id: number;
  outreachEventId: number;
  firstName: string;
  lastName: string;
  name: string;
  phoneNumber: string;
  email: string | null;
  notes: string | null;
  submittedAt: string;
  event: { id: number; eventName: string; eventDate: string } | null;
};

type EventFormState = {
  eventName: string;
  eventDate: string;
  location: string;
  notes: string;
};

const emptyForm: EventFormState = {
  eventName: "",
  eventDate: new Date().toISOString().slice(0, 10),
  location: "",
  notes: "",
};

async function apiJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(options?.headers ?? {}),
    },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "Request failed");
  return data as T;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function absoluteUrl(path: string) {
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

function downloadQrCode(fileName: string) {
  const svg = document.querySelector("[data-evangelism-qr] svg");
  if (!svg) return;
  const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "outreach"}-qr.svg`;
  link.click();
  URL.revokeObjectURL(url);
}

function printQrCode(event: OutreachEvent, qrUrl: string) {
  const printWindow = window.open("", "_blank", "noopener,noreferrer");
  if (!printWindow) return;

  const doc = printWindow.document;

  doc.write("<!DOCTYPE html><html><head></head><body></body></html>");
  doc.close();

  doc.title = `${event.eventName} QR Code`;

  const style = doc.createElement("style");
  style.textContent =
    "body { font-family: Inter, Arial, sans-serif; margin: 0; padding: 48px; text-align: center; color: #0f172a; }" +
    ".card { border: 1px solid #dbeafe; border-radius: 18px; padding: 36px; display: inline-block; }" +
    "h1 { margin: 0 0 8px; font-size: 28px; }" +
    "p { margin: 0 0 24px; color: #475569; }" +
    "img { width: 360px; height: 360px; }" +
    ".url { margin-top: 20px; font-size: 12px; color: #64748b; max-width: 420px; overflow-wrap: anywhere; }";
  doc.head.appendChild(style);

  const card = doc.createElement("div");
  card.className = "card";

  const h1 = doc.createElement("h1");
  h1.textContent = event.eventName;
  card.appendChild(h1);

  const p = doc.createElement("p");
  p.textContent = "Scan to connect with our church.";
  card.appendChild(p);

  const img = doc.createElement("img");
  img.alt = "Outreach QR code";
  img.src = `https://api.qrserver.com/v1/create-qr-code/?size=720x720&data=${encodeURIComponent(qrUrl)}`;
  card.appendChild(img);

  const urlDiv = doc.createElement("div");
  urlDiv.className = "url";
  urlDiv.textContent = qrUrl;
  card.appendChild(urlDiv);

  doc.body.appendChild(card);

  printWindow.focus();
  printWindow.print();
}

function EventForm({
  form,
  setForm,
  onSubmit,
  isSubmitting,
}: {
  form: EventFormState;
  setForm: React.Dispatch<React.SetStateAction<EventFormState>>;
  onSubmit: () => void;
  isSubmitting: boolean;
}) {
  const set = (key: keyof EventFormState, value: string) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Event Name</Label>
          <Input value={form.eventName} onChange={(event) => set("eventName", event.target.value)} placeholder="Saturday Outreach" required />
        </div>
        <div className="space-y-2">
          <Label>Event Date</Label>
          <Input type="date" value={form.eventDate} onChange={(event) => set("eventDate", event.target.value)} required />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Location</Label>
        <Input value={form.location} onChange={(event) => set("location", event.target.value)} placeholder="Community park, mall, campus..." />
      </div>
      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea value={form.notes} onChange={(event) => set("notes", event.target.value)} placeholder="Team details or outreach context" rows={4} />
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Creating..." : "Create Outreach Event"}
      </Button>
    </form>
  );
}

export default function AdminEvangelism() {
  const [, eventParams] = useRoute("/admin/evangelism/events/:id");
  const [isContacts] = useRoute("/admin/evangelism/contacts");
  if (eventParams?.id) return <OutreachEventDetail eventId={Number(eventParams.id)} />;
  return isContacts ? <EvangelismContacts /> : <OutreachEvents />;
}

function EvangelismHeader({ active }: { active: "events" | "contacts" }) {
  return (
    <PageHeader
      eyebrow="Outreach"
      title="Evangelism"
      description="Create outreach QR codes and review contact submissions."
      icon={<Megaphone className="h-6 w-6" />}
      actions={
      <div className="flex rounded-lg border bg-white p-1 shadow-sm">
        <Button asChild variant={active === "events" ? "default" : "ghost"} size="sm">
          <Link href="/admin/evangelism">Outreach Events</Link>
        </Button>
        <Button asChild variant={active === "contacts" ? "default" : "ghost"} size="sm">
          <Link href="/admin/evangelism/contacts">Contacts</Link>
        </Button>
      </div>
      }
    />
  );
}

function OutreachEvents() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [search, setSearch] = React.useState("");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [form, setForm] = React.useState<EventFormState>(emptyForm);

  const eventsQuery = useQuery({
    queryKey: ["outreach-events", search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      const query = params.toString();
      return apiJson<{ events: OutreachEvent[] }>(`/admin/evangelism/events${query ? `?${query}` : ""}`);
    },
  });

  const createEvent = useMutation({
    mutationFn: () => apiJson<{ event: OutreachEvent }>("/admin/evangelism/events", {
      method: "POST",
      body: JSON.stringify({
        eventName: form.eventName,
        eventDate: `${form.eventDate}T12:00:00`,
        location: form.location,
        notes: form.notes,
      }),
    }),
    onSuccess: (data) => {
      toast({ title: "Outreach event created", description: "A QR code and public contact link are ready." });
      setCreateOpen(false);
      setForm(emptyForm);
      void queryClient.invalidateQueries({ queryKey: ["outreach-events"] });
      setLocation(`/admin/evangelism/events/${data.event.id}`);
    },
    onError: (error) => toast({ title: "Could not create outreach event", description: error.message, variant: "destructive" }),
  });

  const events = eventsQuery.data?.events ?? [];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <EvangelismHeader active="events" />

        <Card className="border-blue-100">
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5 text-blue-700" /> Outreach Events</CardTitle>
                <CardDescription>Create event-specific QR codes and review contacts by outreach effort.</CardDescription>
              </div>
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button><Plus className="mr-2 h-4 w-4" />Create Event</Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Create Outreach Event</DialogTitle>
                    <DialogDescription>Church OS will generate a QR code and public contact form for this event.</DialogDescription>
                  </DialogHeader>
                  <EventForm form={form} setForm={setForm} onSubmit={() => createEvent.mutate()} isSubmitting={createEvent.isPending} />
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search outreach events" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>

            {eventsQuery.isLoading ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-36 rounded-lg" />)}
              </div>
            ) : events.length ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {events.map((event) => (
                  <Link key={event.id} href={`/admin/evangelism/events/${event.id}`} className="rounded-lg border bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow-md">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-slate-950">{event.eventName}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">{formatDate(event.eventDate)}</p>
                      </div>
                      <Badge className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50">{event.totalContacts}</Badge>
                    </div>
                    <p className="mt-3 line-clamp-1 text-sm text-muted-foreground">{event.location ?? "No location set"}</p>
                    <div className="mt-4 flex items-center gap-2 text-xs font-medium text-blue-700">
                      <UsersRound className="h-4 w-4" />
                      {event.totalContacts} contacts collected
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed bg-slate-50 p-10 text-center">
                <Megaphone className="mx-auto h-10 w-10 text-blue-700" />
                <h3 className="mt-3 font-semibold">No outreach events yet</h3>
                <p className="mt-1 text-sm text-muted-foreground">Create your first event to generate an event-specific QR code.</p>
                <Button className="mt-4" onClick={() => setCreateOpen(true)}>Create Event</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

function OutreachEventDetail({ eventId }: { eventId: number }) {
  const { toast } = useToast();
  const detailQuery = useQuery({
    queryKey: ["outreach-event-detail", eventId],
    queryFn: () => apiJson<{ event: OutreachEvent; contacts: OutreachContact[] }>(`/admin/evangelism/events/${eventId}`),
  });

  const event = detailQuery.data?.event;
  const contacts = detailQuery.data?.contacts ?? [];
  const contactUrl = event ? absoluteUrl(event.publicContactPath) : "";
  const qrPageUrl = event ? absoluteUrl(event.evangelistQrPath) : "";

  return (
    <AdminLayout>
      <div className="space-y-6">
        <Button asChild variant="ghost" className="-ml-3 w-fit">
          <Link href="/admin/evangelism"><ArrowLeft className="mr-2 h-4 w-4" />Back to Evangelism</Link>
        </Button>

        {detailQuery.isLoading || !event ? (
          <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
            <Skeleton className="h-96 rounded-lg" />
            <Skeleton className="h-96 rounded-lg" />
          </div>
        ) : (
          <>
            <PageHeader
              eyebrow="Outreach Event"
              title={event.eventName}
              description={`${formatDate(event.eventDate)}${event.location ? ` · ${event.location}` : ""}`}
              icon={<Megaphone className="h-6 w-6" />}
              actions={<Badge className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50">{event.totalContacts} contacts</Badge>}
            />
            <div className="grid gap-4 lg:grid-cols-[24rem_1fr]">
              <Card className="border-blue-100">
                <CardHeader>
                  <CardTitle>{event.eventName}</CardTitle>
                  <CardDescription>{formatDate(event.eventDate)}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border bg-white p-5 text-center" data-evangelism-qr>
                    <QRCodeSVG value={contactUrl} size={260} level="M" includeMargin />
                    <p className="mt-3 text-sm font-medium">Scan to connect with our church.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" onClick={() => downloadQrCode(event.eventName)}><Download className="mr-2 h-4 w-4" />Download</Button>
                    <Button variant="outline" onClick={() => printQrCode(event, contactUrl)}><Printer className="mr-2 h-4 w-4" />Print</Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        void navigator.clipboard.writeText(contactUrl);
                        toast({ title: "Contact link copied" });
                      }}
                    >
                      <Copy className="mr-2 h-4 w-4" />Copy Link
                    </Button>
                    <Button asChild variant="outline">
                      <a href={qrPageUrl} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />QR Page</a>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Event Details</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-lg border bg-blue-50/60 p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-blue-700">Contacts</p>
                      <p className="mt-1 text-3xl font-bold text-blue-950">{event.totalContacts}</p>
                    </div>
                    <div className="rounded-lg border bg-white p-4 md:col-span-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Location</p>
                      <p className="mt-1 font-medium">{event.location ?? "No location set"}</p>
                      {event.notes && <p className="mt-3 text-sm leading-6 text-muted-foreground">{event.notes}</p>}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Contacts Collected</CardTitle>
                    <CardDescription>Submissions from this outreach event.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ContactsTable contacts={contacts} showEvent={false} />
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}

function EvangelismContacts() {
  const [search, setSearch] = React.useState("");
  const [selectedContact, setSelectedContact] = React.useState<OutreachContact | null>(null);
  const contactsQuery = useQuery({
    queryKey: ["outreach-contacts", search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      const query = params.toString();
      return apiJson<{ contacts: OutreachContact[] }>(`/admin/evangelism/contacts${query ? `?${query}` : ""}`);
    },
  });

  const contacts = contactsQuery.data?.contacts ?? [];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <EvangelismHeader active="contacts" />
        <Card>
          <CardHeader>
            <CardTitle>Contacts</CardTitle>
            <CardDescription>People who submitted an outreach contact form.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search name, phone, or email" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
            {contactsQuery.isLoading ? <Skeleton className="h-72 rounded-lg" /> : <ContactsTable contacts={contacts} showEvent onSelect={setSelectedContact} />}
          </CardContent>
        </Card>

        <Dialog open={Boolean(selectedContact)} onOpenChange={(open) => !open && setSelectedContact(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selectedContact?.name}</DialogTitle>
              <DialogDescription>{selectedContact?.event?.eventName ?? "Outreach contact"}</DialogDescription>
            </DialogHeader>
            {selectedContact && (
              <div className="space-y-4 text-sm">
                <div className="grid gap-3 rounded-lg border bg-slate-50 p-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Phone</p>
                    <p className="mt-1 font-medium">{selectedContact.phoneNumber}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Email</p>
                    <p className="mt-1 font-medium">{selectedContact.email ?? "Not provided"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Submitted</p>
                    <p className="mt-1 font-medium">{formatDateTime(selectedContact.submittedAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Event</p>
                    <p className="mt-1 font-medium">{selectedContact.event?.eventName ?? "Unknown"}</p>
                  </div>
                </div>
                {selectedContact.notes && (
                  <div className="rounded-lg border bg-white p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Prayer Request / Notes</p>
                    <p className="mt-2 whitespace-pre-wrap leading-6">{selectedContact.notes}</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}

function ContactsTable({ contacts, showEvent, onSelect }: { contacts: OutreachContact[]; showEvent: boolean; onSelect?: (contact: OutreachContact) => void }) {
  if (!contacts.length) {
    return <div className="rounded-lg border border-dashed bg-slate-50 p-8 text-center text-sm text-muted-foreground">No contacts collected yet.</div>;
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Email</TableHead>
            {showEvent && <TableHead>Outreach Event</TableHead>}
            <TableHead>Date Submitted</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.map((contact) => (
            <TableRow key={contact.id} className={onSelect ? "cursor-pointer" : ""} onClick={() => onSelect?.(contact)}>
              <TableCell className="font-medium">{contact.name}</TableCell>
              <TableCell>{contact.phoneNumber}</TableCell>
              <TableCell>{contact.email ?? "—"}</TableCell>
              {showEvent && (
                <TableCell>
                  {contact.event ? (
                    <Link className="font-medium text-blue-700 hover:underline" href={`/admin/evangelism/events/${contact.event.id}`}>
                      {contact.event.eventName}
                    </Link>
                  ) : "—"}
                </TableCell>
              )}
              <TableCell>{formatDateTime(contact.submittedAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
