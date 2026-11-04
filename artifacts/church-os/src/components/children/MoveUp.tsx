import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, ArrowUpCircle } from "lucide-react";
import { apiJson, errorMessage } from "@/lib/api";
import { childName, type Child } from "@/lib/children";
import { useToast } from "@/hooks/use-toast";
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

/** Leaders review every child whose age no longer fits their classroom and move them in one step. */
export function MoveUpDialog({ children }: { children: Child[] }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const ready = children.filter((child) => child.suggestedClassroom);
  const [selected, setSelected] = React.useState<Set<number>>(new Set());

  React.useEffect(() => {
    if (open) setSelected(new Set(ready.map((child) => child.id)));
    // Re-select everyone each time the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const moveUp = useMutation({
    mutationFn: (childIds: number[]) => apiJson<{ moved: Array<{ childId: number; from: string | null; to: string }> }>("/admin/children/move-up", {
      method: "POST",
      body: JSON.stringify({ childIds }),
    }),
    onSuccess: (data) => {
      setOpen(false);
      toast({ title: `Moved ${data.moved.length} ${data.moved.length === 1 ? "child" : "children"}`, description: "Their new classroom is used from their next check-in." });
      void queryClient.invalidateQueries({ queryKey: ["children-checkin"] });
    },
    onError: (error) => toast({ title: "Could not move children", description: errorMessage(error), variant: "destructive" }),
  });

  const toggle = (childId: number) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(childId)) next.delete(childId);
      else next.add(childId);
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <ArrowUpCircle className="h-4 w-4" />
          Move Up{ready.length > 0 ? ` (${ready.length})` : ""}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Move children up</DialogTitle>
          <DialogDescription>
            These children have outgrown their classroom's age range or are in a room that no longer exists.
            Children with special needs stay in the special needs room at any age.
          </DialogDescription>
        </DialogHeader>
        {ready.length > 0 ? (
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={selected.size === ready.length}
                onChange={(event) => setSelected(event.target.checked ? new Set(ready.map((child) => child.id)) : new Set())}
              />
              Select all ({ready.length})
            </label>
            {ready.map((child) => (
              <label key={child.id} className="flex items-center gap-3 rounded-md border p-3 text-sm">
                <input type="checkbox" className="h-4 w-4" checked={selected.has(child.id)} onChange={() => toggle(child.id)} />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{childName(child)}</span>
                  <span className="text-xs text-muted-foreground">{child.age !== null ? `${child.age} years old` : "Age not listed"}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-muted-foreground">{child.classroom || "Not assigned"}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{child.suggestedClassroom}</span>
                </span>
              </label>
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Every child is in the right classroom for their age.
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={selected.size === 0 || moveUp.isPending} onClick={() => moveUp.mutate(Array.from(selected))}>
            {moveUp.isPending ? "Moving..." : `Move ${selected.size} ${selected.size === 1 ? "child" : "children"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
