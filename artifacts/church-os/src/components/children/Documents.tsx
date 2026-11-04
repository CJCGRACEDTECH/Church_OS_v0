import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { FileText, Trash2, Upload } from "lucide-react";
import { apiJson } from "@/lib/api";
import { DOCUMENT_CATEGORY_LABELS, type Child, type ChildDocument, type DocumentCategory, type PermissionSlip } from "@/lib/children";
import { useToast } from "@/hooks/use-toast";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const PERMISSION_SLIPS_QUERY_KEY = ["children-permission-slips"] as const;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Opens a stored document in a new tab, fetched with the signed-in session. */
async function openDocument(document: ChildDocument) {
  // Open the tab during the click so pop-up blockers allow it, then load the file into it.
  const tab = window.open("", "_blank");
  try {
    const blob = await customFetch<Blob>(`/api/admin/children/documents/${document.id}/file`, { responseType: "blob" });
    const url = URL.createObjectURL(blob);
    if (tab) {
      tab.location.href = url;
    } else {
      const link = window.document.createElement("a");
      link.href = url;
      link.download = document.fileName;
      link.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (error) {
    tab?.close();
    throw error;
  }
}

/** Signed forms on a child's profile: medication consent, photo consent, permission slips. */
export function ChildDocumentsSection({ child }: { child: Child }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [category, setCategory] = React.useState<DocumentCategory>(child.missingDocuments[0] ?? "medication_consent");
  const [file, setFile] = React.useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const documentsQuery = useQuery({
    queryKey: ["children-documents", child.id],
    queryFn: () => apiJson<{ documents: ChildDocument[] }>(`/admin/children/${child.id}/documents`),
  });
  const slipsQuery = useQuery({
    queryKey: PERMISSION_SLIPS_QUERY_KEY,
    queryFn: () => apiJson<{ permissionSlips: PermissionSlip[] }>("/admin/children/permission-slips"),
  });
  const documents = documentsQuery.data?.documents ?? [];
  const slips = slipsQuery.data?.permissionSlips ?? [];

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["children-documents", child.id] });
    void queryClient.invalidateQueries({ queryKey: ["children-checkin"] });
    void queryClient.invalidateQueries({ queryKey: PERMISSION_SLIPS_QUERY_KEY });
  };

  const upload = useMutation({
    mutationFn: async ({ formData, file }: { formData: FormData; file: File }) => {
      const params = new URLSearchParams({
        category: String(formData.get("category")),
        title: String(formData.get("title") || DOCUMENT_CATEGORY_LABELS[formData.get("category") as DocumentCategory]),
        fileName: file.name,
      });
      const slipId = formData.get("permissionSlipId");
      if (slipId) params.set("permissionSlipId", String(slipId));
      return apiJson<{ documentId: number }>(`/admin/children/${child.id}/documents?${params}`, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
    },
    onSuccess: () => {
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast({ title: "Document saved" });
      refresh();
    },
    onError: (error) => toast({ title: "Could not upload document", description: error.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (documentId: number) => apiJson(`/admin/children/documents/${documentId}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Document deleted" });
      refresh();
    },
    onError: (error) => toast({ title: "Could not delete document", description: error.message, variant: "destructive" }),
  });

  return (
    <div>
      <p className="mb-2 text-sm font-medium">Forms &amp; Documents</p>
      <div className="space-y-2">
        {documentsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading documents...</p>
        ) : documents.length > 0 ? (
          documents.map((document) => (
            <div key={document.id} className="flex items-center justify-between gap-3 rounded-md border bg-background p-3 text-sm">
              <button
                type="button"
                className="flex min-w-0 items-center gap-2 text-left hover:underline"
                onClick={() => {
                  openDocument(document).catch((error: Error) =>
                    toast({ title: "Could not open document", description: error.message, variant: "destructive" }),
                  );
                }}
              >
                <FileText className="h-4 w-4 shrink-0 text-primary" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{document.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {DOCUMENT_CATEGORY_LABELS[document.category]} · {formatDate(document.createdAt)} · {document.uploadedByName} · {formatSize(document.sizeBytes)}
                  </span>
                </span>
              </button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" size="icon" variant="ghost" aria-label={`Delete ${document.title}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this document?</AlertDialogTitle>
                    <AlertDialogDescription>"{document.title}" will be permanently removed from this child's record.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => remove.mutate(document.id)}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))
        ) : (
          <div className="rounded-md border border-dashed bg-background p-3 text-sm text-muted-foreground">No documents on file.</div>
        )}
        {child.missingDocuments.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            Still needed:
            {child.missingDocuments.map((category) => <Badge key={category} variant="outline" className="border-amber-400">{DOCUMENT_CATEGORY_LABELS[category]}</Badge>)}
          </div>
        )}
      </div>

      <form
        className="mt-3 grid gap-3 rounded-md border bg-muted/20 p-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!file) return;
          if (file.size > MAX_UPLOAD_BYTES) {
            toast({ title: "File is too large", description: "Upload a file under 10 MB.", variant: "destructive" });
            return;
          }
          upload.mutate({ formData: new FormData(event.currentTarget), file });
        }}
      >
        <div className="space-y-2">
          <Label htmlFor={`document-category-${child.id}`}>Type</Label>
          <select
            id={`document-category-${child.id}`}
            name="category"
            value={category}
            onChange={(event) => setCategory(event.target.value as DocumentCategory)}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          >
            {Object.entries(DOCUMENT_CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        {category === "event_permission" ? (
          <div className="space-y-2">
            <Label htmlFor={`document-slip-${child.id}`}>Permission slip</Label>
            <select id={`document-slip-${child.id}`} name="permissionSlipId" required className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">{slips.length > 0 ? "Choose the event" : "Create a permission slip first"}</option>
              {slips.map((slip) => <option key={slip.id} value={slip.id}>{slip.title}</option>)}
            </select>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor={`document-title-${child.id}`}>Title (optional)</Label>
            <Input id={`document-title-${child.id}`} name="title" placeholder={DOCUMENT_CATEGORY_LABELS[category]} />
          </div>
        )}
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`document-file-${child.id}`}>Scan or photo of the signed form</Label>
          <Input
            ref={fileInputRef}
            id={`document-file-${child.id}`}
            type="file"
            accept="application/pdf,image/*"
            required
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </div>
        <div className="flex justify-end sm:col-span-2">
          <Button type="submit" variant="outline" disabled={!file || upload.isPending}>
            <Upload className="h-4 w-4" />
            {upload.isPending ? "Uploading..." : "Upload"}
          </Button>
        </div>
      </form>
    </div>
  );
}
