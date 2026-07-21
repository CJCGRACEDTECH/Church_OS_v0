import React from "react";
import { apiJson } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/AdminLayout";
import PageHeader from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Pencil, PlayCircle, Plus, Trash2, ExternalLink } from "lucide-react";

interface Sermon {
  id: number;
  title: string;
  speakerName: string | null;
  seriesName: string | null;
  description: string | null;
  youtubeVideoId: string;
  sermonDate: string;
  isPublished: boolean;
}

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
  if (!form.youtubeVideoId.trim()) errors.youtubeVideoId = "YouTube video ID is required.";
  if (!form.sermonDate) errors.sermonDate = "Sermon date is required.";
  return errors;
}

function extractYouTubeId(input: string): string {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/);
  if (urlMatch) return urlMatch[1];
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;
  return trimmed;
}


function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default function AdminSermons() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingSermon, setEditingSermon] = React.useState<Sermon | null>(null);
  const [form, setForm] = React.useState<SermonForm>(emptyForm);
  const [errors, setErrors] = React.useState<SermonErrors>({});

  const sermonsQuery = useQuery({
    queryKey: ["admin-sermons"],
    queryFn: () => apiJson<{ sermons: Sermon[] }>("/admin/sermons"),
  });

  const sermons = sermonsQuery.data?.sermons ?? [];

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

  function handleYouTubeIdChange(raw: string) {
    setForm((f) => ({ ...f, youtubeVideoId: extractYouTubeId(raw) }));
    setErrors((e) => ({ ...e, youtubeVideoId: undefined }));
  }

  function submitForm() {
    const newErrors = validateForm(form);
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;
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
        body: JSON.stringify({ ...form, sermonDate: new Date(form.sermonDate).toISOString() }),
      }),
    onSuccess: () => {
      setDialogOpen(false);
      setForm(emptyForm);
      toast({ title: "Sermon added" });
      void queryClient.invalidateQueries({ queryKey: ["admin-sermons"] });
    },
    onError: (error) => toast({ title: "Could not add sermon", description: error.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editingSermon) throw new Error("No sermon selected.");
      return apiJson<{ sermon: Sermon }>(`/admin/sermons/${editingSermon.id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...form, sermonDate: new Date(form.sermonDate).toISOString() }),
      });
    },
    onSuccess: () => {
      setDialogOpen(false);
      setEditingSermon(null);
      setForm(emptyForm);
      toast({ title: "Sermon updated" });
      void queryClient.invalidateQueries({ queryKey: ["admin-sermons"] });
    },
    onError: (error) => toast({ title: "Could not update sermon", description: error.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiJson<{ ok: true }>(`/admin/sermons/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Sermon deleted" });
      void queryClient.invalidateQueries({ queryKey: ["admin-sermons"] });
    },
    onError: (error) => toast({ title: "Could not delete sermon", description: error.message, variant: "destructive" }),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Content"
          title="Sermons"
          description="Manage sermon videos. Published sermons appear on the mobile app and public sermon feed."
          icon={<PlayCircle className="h-6 w-6" />}
          actions={
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openNew}>
                  <Plus className="mr-2 h-4 w-4" /> Add Sermon
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingSermon ? "Edit Sermon" : "Add Sermon"}</DialogTitle>
                  <DialogDescription>
                    Paste a YouTube video ID or URL. The thumbnail and link are generated automatically.
                  </DialogDescription>
                </DialogHeader>
                <SermonFormView
                  form={form}
                  errors={errors}
                  setForm={(f) => { setForm(f); setErrors({}); }}
                  onYouTubeIdChange={handleYouTubeIdChange}
                  onSubmit={submitForm}
                  isSubmitting={isPending}
                  submitLabel={editingSermon ? "Save Changes" : "Add Sermon"}
                />
              </DialogContent>
            </Dialog>
          }
        />

        {sermonsQuery.isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4 space-y-3">
                  <Skeleton className="aspect-video w-full rounded-md" />
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : sermons.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sermons.map((sermon) => (
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
                    className="w-full aspect-video object-cover group-hover:opacity-90 transition-opacity"
                  />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                    <div className="bg-red-600 rounded-full p-3">
                      <PlayCircle className="h-8 w-8 text-white" />
                    </div>
                  </div>
                </a>
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-snug line-clamp-2">{sermon.title}</CardTitle>
                    <Badge variant={sermon.isPublished ? "default" : "secondary"} className="shrink-0 mt-0.5">
                      {sermon.isPublished ? "Published" : "Draft"}
                    </Badge>
                  </div>
                  {sermon.seriesName && (
                    <CardDescription className="text-xs font-medium text-primary">{sermon.seriesName}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-3">
                  <div className="text-sm text-muted-foreground space-y-1">
                    {sermon.speakerName && <p>{sermon.speakerName}</p>}
                    <p>{formatDate(sermon.sermonDate)}</p>
                  </div>
                  {sermon.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{sermon.description}</p>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(sermon)}>
                      <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a href={`https://www.youtube.com/watch?v=${sermon.youtubeVideoId}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Sermon</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{sermon.title}"? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => deleteMutation.mutate(sermon.id)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-16 text-center">
              <PlayCircle className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
              <p className="font-semibold text-muted-foreground">No sermons yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add your first sermon by pasting a YouTube video ID or URL.
              </p>
              <Button className="mt-5" onClick={openNew}>
                <Plus className="mr-2 h-4 w-4" /> Add Sermon
              </Button>
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
  setForm,
  onYouTubeIdChange,
  onSubmit,
  isSubmitting,
  submitLabel,
}: {
  form: SermonForm;
  errors: SermonErrors;
  setForm: (form: SermonForm) => void;
  onYouTubeIdChange: (raw: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  submitLabel: string;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="sermon-title">Title <span className="text-destructive">*</span></Label>
        <Input
          id="sermon-title"
          placeholder="e.g. Faith Over Fear"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
        {errors.title && <p className="text-sm text-destructive">{errors.title}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="sermon-youtube">YouTube Video ID or URL <span className="text-destructive">*</span></Label>
        <Input
          id="sermon-youtube"
          placeholder="e.g. dQw4w9WgXcQ or https://youtube.com/watch?v=..."
          value={form.youtubeVideoId}
          onChange={(e) => onYouTubeIdChange(e.target.value)}
        />
        {errors.youtubeVideoId && <p className="text-sm text-destructive">{errors.youtubeVideoId}</p>}
        {form.youtubeVideoId && (
          <div className="rounded-md overflow-hidden border">
            <img
              src={`https://img.youtube.com/vi/${form.youtubeVideoId}/hqdefault.jpg`}
              alt="Thumbnail preview"
              className="w-full aspect-video object-cover"
            />
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="sermon-speaker">Speaker Name</Label>
          <Input
            id="sermon-speaker"
            placeholder="e.g. Pastor John"
            value={form.speakerName}
            onChange={(e) => setForm({ ...form, speakerName: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sermon-date">Sermon Date <span className="text-destructive">*</span></Label>
          <Input
            id="sermon-date"
            type="date"
            value={form.sermonDate}
            onChange={(e) => setForm({ ...form, sermonDate: e.target.value })}
          />
          {errors.sermonDate && <p className="text-sm text-destructive">{errors.sermonDate}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="sermon-series">Series Name</Label>
        <Input
          id="sermon-series"
          placeholder="e.g. Faith Over Fear"
          value={form.seriesName}
          onChange={(e) => setForm({ ...form, seriesName: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="sermon-desc">Description</Label>
        <Textarea
          id="sermon-desc"
          placeholder="A brief description of this message..."
          rows={3}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </div>

      <div className="flex items-center justify-between rounded-md border px-4 py-3">
        <div>
          <p className="text-sm font-medium">Published</p>
          <p className="text-xs text-muted-foreground">Published sermons appear in the mobile app and public feed.</p>
        </div>
        <Switch
          checked={form.isPublished}
          onCheckedChange={(checked) => setForm({ ...form, isPublished: checked })}
        />
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={onSubmit} disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : submitLabel}
        </Button>
      </div>
    </div>
  );
}
