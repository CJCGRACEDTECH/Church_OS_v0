import React from "react";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { readProfilePhotoFile } from "@/lib/profile-photo";
import type { EventFormState } from "@/lib/events";

function TextInput({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
        {children}
      </select>
    </div>
  );
}

export default function EventForm({
  form,
  setForm,
  onSubmit,
  submitLabel,
  isSubmitting,
}: {
  form: EventFormState;
  setForm: React.Dispatch<React.SetStateAction<EventFormState>>;
  onSubmit: () => void;
  submitLabel: string;
  isSubmitting: boolean;
}) {
  const set = (key: keyof EventFormState, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));

  async function handlePoster(file: File | undefined) {
    if (!file) return;
    const poster = await readProfilePhotoFile(file);
    set("posterUrl", poster);
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <TextInput label="Event Title" value={form.title} onChange={(value) => set("title", value)} required />
        <SelectField label="Event Type" value={form.eventType} onChange={(value) => set("eventType", value)}>
          <option value="service">Service</option>
          <option value="bible_study">Bible Study</option>
          <option value="prayer">Prayer</option>
          <option value="baptism">Baptism</option>
          <option value="fasting_season">Fasting Season</option>
          <option value="special_event">Special Event</option>
          <option value="announcement">Announcement</option>
        </SelectField>
        <TextInput label="Start Date" type="date" value={form.startDate} onChange={(value) => set("startDate", value)} required />
        <TextInput label="Start Time" type="time" value={form.startTime} onChange={(value) => set("startTime", value)} required />
        <TextInput label="End Date" type="date" value={form.endDate} onChange={(value) => set("endDate", value)} required />
        <TextInput label="End Time" type="time" value={form.endTime} onChange={(value) => set("endTime", value)} required />
        <TextInput label="Location" value={form.location} onChange={(value) => set("location", value)} />
        <SelectField label="Mode" value={form.eventMode} onChange={(value) => set("eventMode", value)}>
          <option value="in_person">In Person</option>
          <option value="online">Online</option>
          <option value="hybrid">Hybrid</option>
        </SelectField>
        <TextInput label="Zoom Link" type="url" value={form.zoomLink} onChange={(value) => set("zoomLink", value)} />
        <TextInput label="YouTube Link" type="url" value={form.youtubeLink} onChange={(value) => set("youtubeLink", value)} />
        <SelectField label="Status" value={form.status} onChange={(value) => set("status", value)}>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="cancelled">Cancelled</option>
        </SelectField>
        <SelectField label="Visibility" value={form.visibility} onChange={(value) => set("visibility", value)}>
          <option value="public">Public / Members</option>
          <option value="admin_only">Admins Only</option>
        </SelectField>
      </div>

      <div className="rounded-md border p-4 space-y-3">
        <div className="flex items-center gap-3">
          <input
            id="isRecurring"
            type="checkbox"
            checked={form.isRecurring}
            onChange={(event) => {
              set("isRecurring", event.target.checked);
              set("recurrencePattern", event.target.checked ? "weekly" : "one_time");
            }}
            className="h-4 w-4 rounded border-input"
          />
          <Label htmlFor="isRecurring" className="font-medium cursor-pointer">Recurring Event</Label>
        </div>
        {form.isRecurring && (
          <div className="space-y-3 pl-7">
            <p className="text-xs text-muted-foreground">
              This event repeats on the same day of the week at the same time. Each week generates a separate attendance session you can track independently.
            </p>
            <SelectField label="Repeat Pattern" value={form.recurrencePattern} onChange={(value) => set("recurrencePattern", value)}>
              <option value="weekly">Weekly — every week on the same day</option>
              <option value="custom">Custom — manage dates manually</option>
            </SelectField>
          </div>
        )}</div>

      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea value={form.description} onChange={(event) => set("description", event.target.value)} rows={4} />
      </div>

      <div className="grid gap-4 md:grid-cols-[220px_1fr] md:items-end">
        {form.posterUrl ? (
          <img src={form.posterUrl} alt="" className="aspect-video w-full rounded-md border object-cover" />
        ) : (
          <div className="flex aspect-video w-full items-center justify-center rounded-md border bg-muted text-sm text-muted-foreground">No poster</div>
        )}
        <div className="space-y-2">
          <Label htmlFor="poster">Poster / Image</Label>
          <Input id="poster" type="file" accept="image/*" onChange={(event) => void handlePoster(event.target.files?.[0])} />
        </div>
      </div>

      <DialogFooter>
        <Button type="submit" disabled={isSubmitting}>{submitLabel}</Button>
      </DialogFooter>
    </form>
  );
}
