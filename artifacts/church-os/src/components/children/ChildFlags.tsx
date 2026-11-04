import { AlertTriangle, FileWarning, HeartHandshake, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DOCUMENT_CATEGORY_LABELS, isNewChild, type Child } from "@/lib/children";

/** Small alert badges shown next to a child's name wherever the child appears. */
export default function ChildFlags({ child, compact = false }: { child: Child; compact?: boolean }) {
  const missing = child.missingDocuments.map((category) => DOCUMENT_CATEGORY_LABELS[category]);

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {child.openIncidentCount > 0 && (
        <Badge variant="destructive" className="gap-1" title="Open incident: a leader needs to follow up with the parents">
          <AlertTriangle className="h-3 w-3" />
          {compact ? child.openIncidentCount : `Open incident${child.openIncidentCount > 1 ? `s (${child.openIncidentCount})` : ""}`}
        </Badge>
      )}
      {child.hasSpecialNeeds && (
        <Badge className="gap-1 border-transparent bg-violet-600 text-white hover:bg-violet-600" title="Special needs">
          <HeartHandshake className="h-3 w-3" />
          {compact ? null : "Special needs"}
        </Badge>
      )}
      {missing.length > 0 && (
        <Badge variant="outline" className="gap-1 border-amber-400 bg-amber-50 text-amber-900" title={`Missing: ${missing.join(", ")}`}>
          <FileWarning className="h-3 w-3" />
          {compact ? null : `Missing ${missing.join(", ").toLowerCase()}`}
        </Badge>
      )}
      {child.isVisitor ? (
        <Badge variant="outline" className="gap-1 border-sky-300 bg-sky-50 text-sky-900">
          <Sparkles className="h-3 w-3" />
          Visitor
        </Badge>
      ) : isNewChild(child) ? (
        <Badge variant="outline" className="gap-1 border-emerald-300 bg-emerald-50 text-emerald-900">
          <Sparkles className="h-3 w-3" />
          New
        </Badge>
      ) : null}
    </span>
  );
}
