import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, School, Trash2 } from "lucide-react";
import { apiJson, errorMessage } from "@/lib/api";
import { classroomAgeLabel, type Classroom } from "@/lib/children";
import { useToast } from "@/hooks/use-toast";
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

export const CLASSROOMS_QUERY_KEY = ["children-classrooms"] as const;

function classroomPayload(formData: FormData) {
  return {
    name: formData.get("name"),
    minAgeYears: formData.get("minAgeYears"),
    maxAgeYears: formData.get("maxAgeYears"),
    isSpecialNeeds: formData.get("isSpecialNeeds") === "on",
    sortOrder: formData.get("sortOrder"),
  };
}

function ClassroomFields({ classroom, idPrefix }: { classroom?: Classroom; idPrefix: string }) {
  const [isSpecialNeeds, setIsSpecialNeeds] = React.useState(classroom?.isSpecialNeeds ?? false);
  return (
    <>
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-name`}>Name</Label>
        <Input id={`${idPrefix}-name`} name="name" required defaultValue={classroom?.name} placeholder="e.g. Kindergarten" />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-min`}>Min age</Label>
        <Input id={`${idPrefix}-min`} name="minAgeYears" type="number" min={0} max={18} disabled={isSpecialNeeds} defaultValue={classroom?.minAgeYears ?? ""} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-max`}>Max age</Label>
        <Input id={`${idPrefix}-max`} name="maxAgeYears" type="number" min={0} max={18} disabled={isSpecialNeeds} defaultValue={classroom?.maxAgeYears ?? ""} />
      </div>
      <label className="flex items-center gap-2 text-sm sm:pb-2.5">
        <input type="checkbox" name="isSpecialNeeds" checked={isSpecialNeeds} onChange={(event) => setIsSpecialNeeds(event.target.checked)} className="h-4 w-4" />
        Special needs room
      </label>
      <input type="hidden" name="sortOrder" value={classroom?.sortOrder ?? 0} />
    </>
  );
}

/** Leaders define the real classrooms; new children are suggested a room by age. */
export function ClassroomsDialog({ classrooms }: { classrooms: Classroom[] }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: CLASSROOMS_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: ["children-checkin"] });
  };

  const save = useMutation({
    mutationFn: ({ classroomId, formData }: { classroomId?: number; formData: FormData }) =>
      apiJson(classroomId ? `/admin/children/classrooms/${classroomId}` : "/admin/children/classrooms", {
        method: classroomId ? "PATCH" : "POST",
        body: JSON.stringify(classroomPayload(formData)),
      }),
    onSuccess: (_, { classroomId }) => {
      toast({ title: classroomId ? "Classroom updated" : "Classroom added" });
      refresh();
    },
    onError: (error) => toast({ title: "Could not save classroom", description: errorMessage(error), variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (classroomId: number) => apiJson(`/admin/children/classrooms/${classroomId}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Classroom removed", description: "Children already in it keep their classroom until edited." });
      refresh();
    },
    onError: (error) => toast({ title: "Could not remove classroom", description: errorMessage(error), variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <School className="h-4 w-4" />
          Classrooms
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Classrooms</DialogTitle>
          <DialogDescription>
            Set each room's age range. New children are suggested a room by age; children with special needs go to the special needs room at any age.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {classrooms.map((classroom) => (
            <form
              key={`${classroom.id}-${classroom.name}-${classroom.minAgeYears}-${classroom.maxAgeYears}-${classroom.isSpecialNeeds}`}
              className="grid items-end gap-2 rounded-md border p-3 sm:grid-cols-[1fr_80px_80px_auto_auto_auto]"
              onSubmit={(event) => {
                event.preventDefault();
                save.mutate({ classroomId: classroom.id, formData: new FormData(event.currentTarget) });
              }}
            >
              <ClassroomFields classroom={classroom} idPrefix={`classroom-${classroom.id}`} />
              <Button type="submit" size="sm" variant="outline" disabled={save.isPending}>Save</Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={`Remove ${classroom.name}`}
                disabled={remove.isPending}
                onClick={() => {
                  if (window.confirm(`Remove the ${classroom.name} classroom?`)) remove.mutate(classroom.id);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </form>
          ))}
          {classrooms.length === 0 && (
            <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">No classrooms yet. Add the first one below.</div>
          )}
        </div>

        <form
          className="grid items-end gap-2 rounded-md border border-dashed p-3 sm:grid-cols-[1fr_80px_80px_auto_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            save.mutate({ formData: new FormData(form) }, { onSuccess: () => form.reset() });
          }}
        >
          <ClassroomFields idPrefix="classroom-new" />
          <Button type="submit" size="sm" disabled={save.isPending}>
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </form>
        {classrooms.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {classrooms.map((classroom) => `${classroom.name}: ${classroomAgeLabel(classroom)}`).join(" · ")}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
