import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ClipboardPen } from "lucide-react";
import { apiJson, errorMessage } from "@/lib/api";
import { childName, type Child, type Incident } from "@/lib/children";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const INCIDENTS_QUERY_KEY = ["children-incidents"] as const;

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function localDateTimeValue(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function useRefreshChildren() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["children-checkin"] });
    void queryClient.invalidateQueries({ queryKey: INCIDENTS_QUERY_KEY });
  };
}

/** Anyone running check-in can report an incident for a child. */
export function ReportIncidentDialog({ child, size = "sm" }: { child: Child; size?: "sm" | "default" }) {
  const { toast } = useToast();
  const refresh = useRefreshChildren();
  const [open, setOpen] = React.useState(false);

  const report = useMutation({
    mutationFn: (formData: FormData) => apiJson<{ incidentId: number }>(`/admin/children/${child.id}/incidents`, {
      method: "POST",
      body: JSON.stringify({
        occurredAt: new Date(String(formData.get("occurredAt"))).toISOString(),
        description: formData.get("description"),
        actionTaken: formData.get("actionTaken"),
      }),
    }),
    onSuccess: () => {
      setOpen(false);
      toast({ title: "Incident reported", description: "A Children Ministry leader will follow up with the parents." });
      refresh();
    },
    onError: (error) => toast({ title: "Could not report incident", description: errorMessage(error), variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size={size} variant="outline" onClick={(event) => event.stopPropagation()}>
          <ClipboardPen className="h-4 w-4" />
          Report Incident
        </Button>
      </DialogTrigger>
      <DialogContent onClick={(event) => event.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Report an incident for {childName(child)}</DialogTitle>
          <DialogDescription>
            Write down what happened while it is fresh. The child will show an alert until a leader talks with the parents and closes it.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            report.mutate(new FormData(event.currentTarget));
          }}
        >
          <div className="space-y-2">
            <Label htmlFor={`incident-time-${child.id}`}>When did it happen?</Label>
            <Input id={`incident-time-${child.id}`} name="occurredAt" type="datetime-local" required defaultValue={localDateTimeValue()} max={localDateTimeValue()} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`incident-description-${child.id}`}>What happened?</Label>
            <Textarea id={`incident-description-${child.id}`} name="description" required rows={4} placeholder="Describe what happened, who was involved, and any injury." />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`incident-action-${child.id}`}>What did you do? (optional)</Label>
            <Textarea id={`incident-action-${child.id}`} name="actionTaken" rows={2} placeholder="First aid given, children separated, etc." />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={report.isPending}>{report.isPending ? "Saving..." : "Save Report"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResolveIncidentDialog({ incident }: { incident: Incident }) {
  const { toast } = useToast();
  const refresh = useRefreshChildren();
  const [open, setOpen] = React.useState(false);

  const resolve = useMutation({
    mutationFn: (resolutionNotes: string) => apiJson(`/admin/children/incidents/${incident.id}/resolve`, {
      method: "POST",
      body: JSON.stringify({ resolutionNotes }),
    }),
    onSuccess: () => {
      setOpen(false);
      toast({ title: "Incident closed", description: `The alert for ${incident.childName} has been cleared.` });
      refresh();
    },
    onError: (error) => toast({ title: "Could not close incident", description: errorMessage(error), variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <CheckCircle2 className="h-4 w-4" />
          Close Incident
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Close incident for {incident.childName}</DialogTitle>
          <DialogDescription>
            Record how it was handled, including the conversation with the parents. This stays on the child's record.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            resolve.mutate(String(new FormData(event.currentTarget).get("resolutionNotes") ?? ""));
          }}
        >
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <p className="font-medium">{formatDateTime(incident.occurredAt)}</p>
            <p className="mt-1">{incident.description}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`resolution-${incident.id}`}>Follow-up notes</Label>
            <Textarea id={`resolution-${incident.id}`} name="resolutionNotes" required rows={4} placeholder="Who spoke with the parents, when, and what was agreed." />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={resolve.isPending}>{resolve.isPending ? "Saving..." : "Close Incident"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function IncidentCard({ incident, showChild = false }: { incident: Incident; showChild?: boolean }) {
  const isOpen = incident.status === "open";
  return (
    <div className={`rounded-md border p-3 text-sm ${isOpen ? "border-destructive/40 bg-destructive/5" : "bg-background"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          {showChild && <p className="font-medium">{incident.childName}</p>}
          <p className="text-xs text-muted-foreground">
            {formatDateTime(incident.occurredAt)} · {incident.classroom || "No classroom"} · Reported by {incident.reportedByName}
          </p>
        </div>
        <Badge variant={isOpen ? "destructive" : "secondary"}>{isOpen ? "Open" : "Closed"}</Badge>
      </div>
      <p className="mt-2">{incident.description}</p>
      {incident.actionTaken && <p className="mt-1 text-muted-foreground"><span className="font-medium text-foreground">Action taken:</span> {incident.actionTaken}</p>}
      {incident.resolutionNotes && (
        <p className="mt-2 rounded border bg-muted/30 p-2">
          <span className="font-medium">Follow-up:</span> {incident.resolutionNotes}
          <span className="block text-xs text-muted-foreground">
            Closed by {incident.resolvedByName ?? "a leader"}{incident.resolvedAt ? ` on ${formatDateTime(incident.resolvedAt)}` : ""}
          </span>
        </p>
      )}
      {isOpen && <div className="mt-3 flex justify-end"><ResolveIncidentDialog incident={incident} /></div>}
    </div>
  );
}

/** Incident history on a child's profile (leaders only). */
export function ChildIncidentsSection({ child }: { child: Child }) {
  const incidentsQuery = useQuery({
    queryKey: [...INCIDENTS_QUERY_KEY, "child", child.id],
    queryFn: () => apiJson<{ incidents: Incident[] }>(`/admin/children/incidents?childId=${child.id}`),
  });
  const incidents = incidentsQuery.data?.incidents ?? [];

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Incidents</p>
        <ReportIncidentDialog child={child} />
      </div>
      {incidentsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading incidents...</p>
      ) : incidents.length > 0 ? (
        <div className="space-y-2">{incidents.map((incident) => <IncidentCard key={incident.id} incident={incident} />)}</div>
      ) : (
        <div className="rounded-md border border-dashed bg-background p-3 text-sm text-muted-foreground">No incidents recorded.</div>
      )}
    </div>
  );
}

/** Every open incident in the ministry, for leaders to follow up on. */
export function OpenIncidentsDialog({ openCount }: { openCount: number }) {
  const [open, setOpen] = React.useState(false);
  const incidentsQuery = useQuery({
    queryKey: [...INCIDENTS_QUERY_KEY, "open"],
    queryFn: () => apiJson<{ incidents: Incident[] }>("/admin/children/incidents?status=open"),
    enabled: open,
  });
  const incidents = incidentsQuery.data?.incidents ?? [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={openCount > 0 ? "destructive" : "outline"}>
          <AlertTriangle className="h-4 w-4" />
          Incidents{openCount > 0 ? ` (${openCount} open)` : ""}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Open incidents</DialogTitle>
          <DialogDescription>Talk with each family, then close the incident with notes to clear the child's alert.</DialogDescription>
        </DialogHeader>
        {incidentsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading incidents...</p>
        ) : incidents.length > 0 ? (
          <div className="space-y-3">{incidents.map((incident) => <IncidentCard key={incident.id} incident={incident} showChild />)}</div>
        ) : (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">No open incidents.</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
