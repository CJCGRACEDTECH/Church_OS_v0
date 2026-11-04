import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, Plus } from "lucide-react";
import { apiJson, errorMessage } from "@/lib/api";
import { childName, type Child, type PermissionSlip } from "@/lib/children";
import { useToast } from "@/hooks/use-toast";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PERMISSION_SLIPS_QUERY_KEY } from "./Documents";

function formatEventDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

/** Permission slips for children's events, showing which families have returned theirs. */
export function PermissionSlipsDialog({ children }: { children: Child[] }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [classroomFilter, setClassroomFilter] = React.useState("");

  const slipsQuery = useQuery({
    queryKey: PERMISSION_SLIPS_QUERY_KEY,
    queryFn: () => apiJson<{ permissionSlips: PermissionSlip[] }>("/admin/children/permission-slips"),
    enabled: open,
  });
  const slips = slipsQuery.data?.permissionSlips ?? [];
  const classrooms = Array.from(new Set(children.map((child) => child.classroom || "Unassigned"))).sort();
  const invited = classroomFilter ? children.filter((child) => (child.classroom || "Unassigned") === classroomFilter) : children;

  const create = useMutation({
    mutationFn: (formData: FormData) => apiJson<{ permissionSlipId: number }>("/admin/children/permission-slips", {
      method: "POST",
      body: JSON.stringify({
        title: formData.get("title"),
        eventDate: formData.get("eventDate"),
        notes: formData.get("notes"),
      }),
    }),
    onSuccess: () => {
      toast({ title: "Permission slip created", description: "Upload each family's signed slip from the child's profile." });
      void queryClient.invalidateQueries({ queryKey: PERMISSION_SLIPS_QUERY_KEY });
    },
    onError: (error) => toast({ title: "Could not create permission slip", description: errorMessage(error), variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <ClipboardCheck className="h-4 w-4" />
          Permission Slips
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Permission slips</DialogTitle>
          <DialogDescription>
            Create a slip for an event, then upload each signed slip on the child's profile. Children without one are listed as missing.
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-3 rounded-md border bg-muted/20 p-3 sm:grid-cols-[1fr_170px_auto] sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            create.mutate(new FormData(form), { onSuccess: () => form.reset() });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="slip-title">Event</Label>
            <Input id="slip-title" name="title" required placeholder="e.g. Children's Christmas Program" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slip-date">Event date</Label>
            <Input id="slip-date" name="eventDate" type="date" />
          </div>
          <Button type="submit" disabled={create.isPending}>
            <Plus className="h-4 w-4" />
            {create.isPending ? "Creating..." : "Create"}
          </Button>
        </form>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Label htmlFor="slip-classroom">Who is invited:</Label>
          <select
            id="slip-classroom"
            value={classroomFilter}
            onChange={(event) => setClassroomFilter(event.target.value)}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">All children</option>
            {classrooms.map((classroom) => <option key={classroom} value={classroom}>{classroom}</option>)}
          </select>
        </div>

        {slipsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading permission slips...</p>
        ) : slips.length > 0 ? (
          <Accordion type="single" collapsible className="space-y-2">
            {slips.map((slip) => {
              const returned = new Set(slip.returnedChildIds);
              const missing = invited.filter((child) => !returned.has(child.id));
              const returnedCount = invited.length - missing.length;
              return (
                <AccordionItem key={slip.id} value={String(slip.id)} className="rounded-md border px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex w-full flex-col gap-1 pr-3 text-left sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="font-medium">{slip.title}</div>
                        <div className="text-xs text-muted-foreground">{slip.eventDate ? formatEventDate(slip.eventDate) : "No date set"}</div>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="secondary">{returnedCount} returned</Badge>
                        {missing.length > 0 && <Badge variant="outline" className="border-amber-400 bg-amber-50 text-amber-900">{missing.length} missing</Badge>}
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {missing.length > 0 ? (
                      <div className="grid gap-1 sm:grid-cols-2">
                        {missing.map((child) => (
                          <div key={child.id} className="flex justify-between gap-2 rounded border px-2 py-1 text-sm">
                            <span>{childName(child)}</span>
                            <span className="text-muted-foreground">{child.guardians[0]?.phoneNumber || child.classroom || ""}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Every invited child has a signed slip on file.</p>
                    )}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        ) : (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">No permission slips yet.</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
