import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/AdminLayout";
import PageHeader from "@/components/PageHeader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiJson } from "@/lib/api";
import { BookOpen, ExternalLink, Pencil, Plus, Search, Trash2, Video } from "lucide-react";

export type Sermon = {
  id: number;
  churchId: number;
  title: string;
  speakerName: string | null;
  seriesName: string | null;
  description: string | null;
  youtubeVideoId: string;
  sermonDate: string;
  isPublished: boolean;
  createdByUserId: number | null;
  createdAt: string;
  updatedAt: string;
};

type SermonForm = {
  title: string;
  speakerName: string;
  seriesName: string;
  description: string;
  youtubeVideoId: string;
  sermonDate: string;
  isPublished: boolean;
};

type SermonErrors = {
  title?: string;
  youtubeVideoId?: string;
  sermonDate?: string;
};

const emptyForm: SermonForm = {
  title: "",
  speakerName: "",
  seriesName: "",
  description: "",
  youtubeVideoId: "",
  sermonDate: new Date().toISOString().slice(0, 10),
  isPublished: false,
};

function sermonToForm(sermon: Sermon): SermonForm {
  return {
    title: sermon.title,
    speakerName: sermon.speakerName ?? "",
    seriesName: sermon.seriesName ?? "",
    description: sermon.description ?? "",
    youtubeVideoId: sermon.youtubeVideoId,
    sermonDate: sermon.sermonDate.slice(0, 10),
    isPublished: sermon.isPublished,
  };
}

function validateForm(form: SermonForm): SermonErrors {
  const errors: SermonErrors = {};
  if (!form.title.trim()) errors.title = "Title is required.";
  if (!form.youtubeVideoId.trim()) errors.youtubeVideoId = "YouTube Video ID is required.";
  if (!form.sermonDate) errors.sermonDate = "Sermon date is required.";
  return errors;
}

function extractVideoId(input: string): string {
  const trimmed = input.trim();
  // Handle full YouTube URLs
  try {
    const url = new URL(trimmed);
    if (url.hostname.includes("youtube.com")) {
      return url.searchParams.get("v") ?? trimmed;
    }
    if (url.hostname === "youtu.be") {
      return url.pathname.slice(1);
    }
  } catch {
    // Not a URL — treat as raw video ID
  }
  return trimmed;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function AdminSermons() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [form, setForm] = React.useState<SermonForm>(emptyForm);
  const [errors, setErrors] = React.useState<SermonErrors>({});
  const [editingSermon, setEditingSermon] = React.useState<Sermon | null>(null);

  const sermonsQuery = useQuery({
    queryKey: ["admin-sermons"],
    queryFn: () => apiJson<{ sermons: Sermon[] }>("/admin/sermons"),
  });

  const sermons = sermonsQuery.data?.sermons ?? [];
  const filtered = search.trim()
    ? sermons.filter(
        (s) =>
          s.title.toLowerCase().includes(search.toLowerCase()) ||
          (s.speakerName ?? "").toLowerCase().includes(search.toLowerCase()) ||
          (s.seriesName ?? "").toLowerCase().includes(search.toLowerCase()),
      )
    : sermons;

  function openNew() {
    setEditingSermon(null);
    setForm(emptyForm);
    setErrors({});
    setDialogOpen(true);
  }

  function openEdit(sermon: Sermon) {
    setEditingSermon(sermon);
    setForm(sermonToForm(sermon));
    setErrors({});
    setDialogOpen(true);
  }

  function updateForm(patch: Partial<SermonForm>) {
    setForm((prev) => ({ ...prev, ...patch }));
    setErrors({});
  }

  function handleVideoIdChange(value: string) {
    updateForm({ youtubeVideoId: extractVideoId(value) });
  }

  function submit() {
    const validationErrors = validateForm(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;
    if (editingSermon) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  }

  const createMutation = useMutation({
    mutationFn: () =>
      apiJson<{ sermon: Sermon }>("/admin/sermons", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          youtubeVideoId: extractVideoId(form.youtubeVideoId),
          sermonDate: new Date(form.sermonDate).toISOString(),
        }),
      }),
    onSuccess: () => {
      setDialogOpen(false);
      setForm(emptyForm);
      toast({ title: "Sermon added" });
      void queryClient.invalidateQueries({ queryKey: ["admin-sermons"] });
    },
    onError: (error) =>
      toast({ title: "Could not add sermon", description: error.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editingSermon) throw new Error("No sermon selected.");
      return apiJson<{ sermon: Sermon }>(`/admin/sermons/${editingSermon.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...form,
          youtubeVideoId: extractVideoId(form.youtubeVideoId),
          sermonDate: new Date(form.sermonDate).toISOString(),
        }),
      });
    },
    onSuccess: () => {
      setDialogOpen(false);
      setEditingSermon(null);
      setForm(emptyForm);
      toast({ title: "Sermon updated" });
      void queryClient.invalidateQueries({ queryKey: ["admin-sermons"] });
    },
    onError: (error) =>
      toast({ title: "Could not update sermon", description: error.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!editingSermon) throw new Error("No sermon selected.");
      return apiJson<{ ok: true }>(`/admin/sermons/${editingSermon.id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      setDialogOpen(false);
      setEditingSermon(null);
      setForm(emptyForm);
      toast({ title: "Sermon deleted" });
      void queryClient.invalidateQueries({ queryKey: ["admin-sermons"] });
    },
    onError: (error) =>
      toast({ title: "Could not delete sermon", description: error.message, variant: "destructive" }),
  });

  const isSaving = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Content"
          title="Sermons"
          description="Add and manage sermon recordings. Published sermons appear on the Watch page."
          icon={<Video className="h-6 w-6" />}
          actions={
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openNew}>
                  <Plus className="mr-2 h-4 w-4" /> Add Sermon
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingSermon ? "Edit Sermon" : "Add Sermon"}</DialogTitle>
                  <DialogDescription>
                    {editingSermon
                      ? "Update this sermon's details."
                      : "Enter the YouTube video ID or URL and sermon details."}
                  </DialogDescription>
                </DialogHeader>
                <SermonFormView
                  form={form}
                  errors={errors}
                  onChange={updateForm}
                  onVideoIdChange={handleVideoIdChange}
                  onSubmit={submit}
                  isSaving={isSaving}
                  submitLabel={editingSermon ? "Save Changes" : "Add Sermon"}
                  editing={editingSermon}
                  onDelete={() => deleteMutation.mutate()}
                />
              </DialogContent>
            </Dialog>
          }
        />

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by title, speaker, or series…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Sermon list */}
        {sermonsQuery.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-0">
                  <Skeleton className="h-40 w-full rounded-t-lg" />
                  <div className="p-4 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((sermon) => (
              <Card key={sermon.id} className="overflow-hidden">
                <a
                  href={`https://www.youtube.com/watch?v=${sermon.youtubeVideoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block relative group"
                >
                  <img
                    src={`https://img.youtube.com/vi/${sermon.youtubeVideoId}/hqdefault.jpg`}
                    alt={sermon.title}
                    className="w-full h-40 object-cover group-hover:opacity-90 transition-opacity"
                  />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                    <ExternalLink className="h-8 w-8 text-white drop-shadow" />
                  </div>
                </a>
                <CardHeader className="pb-2 pt-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm leading-tight line-clamp-2">{sermon.title}</CardTitle>
                    <Badge variant={sermon.isPublished ? "default" : "secondary"} className="shrink-0 text-xs">
                      {sermon.isPublished ? "Published" : "Draft"}
                    </Badge>
                  </div>
                  {(sermon.speakerName || sermon.seriesName) && (
                    <CardDescription className="text-xs">
                      {[sermon.speakerName, sermon.seriesName].filter(Boolean).join(" · ")}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="pb-3 pt-0">
                  <p className="text-xs text-muted-foreground mb-3">{formatDate(sermon.sermonDate)}</p>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={() => openEdit(sermon)}
                  >
                    <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16">
              <BookOpen className="h-10 w-10 text-muted-foreground/40" />
              <p className="font-medium text-muted-foreground">
                {search ? "No sermons match your search" : "No sermons yet"}
              </p>
              {!search && (
                <p className="text-sm text-muted-foreground text-center max-w-xs">
                  Add your first sermon using a YouTube video ID or URL. Published sermons appear on the
                  Watch page even without a YouTube API key.
                </p>
              )}
              {!search && (
                <Button className="mt-2" onClick={openNew}>
                  <Plus className="mr-2 h-4 w-4" /> Add Sermon
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}

function SermonFormView({
  form,
  errors,
  onChange,
  onVideoIdChange,
  onSubmit,
  isSaving,
  submitLabel,
  editing,
  onDelete,
}: {
  form: SermonForm;
  errors: SermonErrors;
  onChange: (patch: Partial<SermonForm>) => void;
  onVideoIdChange: (value: string) => void;
  onSubmit: () => void;
  isSaving: boolean;
  submitLabel: string;
  editing: Sermon | null;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Sermon Title *</Label>
        <Input
          value={form.title}
          placeholder="e.g. Walking by Faith"
          onChange={(e) => onChange({ title: e.target.value })}
        />
        {errors.title && <p className="text-sm text-destructive">{errors.title}</p>}
      </div>

      <div className="space-y-2">
        <Label>YouTube Video ID or URL *</Label>
        <Input
          value={form.youtubeVideoId}
          placeholder="e.g. dQw4w9WgXcQ or https://youtube.com/watch?v=..."
          onChange={(e) => onVideoIdChange(e.target.value)}
        />
        {errors.youtubeVideoId && <p className="text-sm text-destructive">{errors.youtubeVideoId}</p>}
        {form.youtubeVideoId && !errors.youtubeVideoId && (
          <p className="text-xs text-muted-foreground">
            Video ID: <span className="font-mono">{extractVideoId(form.youtubeVideoId)}</span>
          </p>
        )}
      </div>

      {form.youtubeVideoId && (
        <img
          src={`https://img.youtube.com/vi/${extractVideoId(form.youtubeVideoId)}/mqdefault.jpg`}
          alt="Thumbnail preview"
          className="w-full max-w-xs rounded-md border"
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Speaker Name</Label>
          <Input
            value={form.speakerName}
            placeholder="e.g. Pastor James"
            onChange={(e) => onChange({ speakerName: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Series</Label>
          <Input
            value={form.seriesName}
            placeholder="e.g. Book of Romans"
            onChange={(e) => onChange({ seriesName: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Sermon Date *</Label>
          <Input
            type="date"
            value={form.sermonDate}
            onChange={(e) => onChange({ sermonDate: e.target.value })}
          />
          {errors.sermonDate && <p className="text-sm text-destructive">{errors.sermonDate}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea
          value={form.description}
          placeholder="Brief summary of the sermon…"
          rows={3}
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </div>

      <div className="flex items-center gap-3 rounded-md border p-3">
        <Switch
          id="isPublished"
          checked={form.isPublished}
          onCheckedChange={(checked) => onChange({ isPublished: checked })}
        />
        <div>
          <Label htmlFor="isPublished" className="cursor-pointer">Published</Label>
          <p className="text-xs text-muted-foreground">
            Published sermons appear on the Watch page.
          </p>
        </div>
      </div>

      <div className="flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {editing && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive" disabled={isSaving}>
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this sermon?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently remove the sermon record. The YouTube video itself will not be affected.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={onDelete}
                  >
                    Delete Sermon
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
        <Button onClick={onSubmit} disabled={isSaving}>
          {isSaving ? "Saving…" : submitLabel}
        </Button>
      </div>
    </div>
  );
}
