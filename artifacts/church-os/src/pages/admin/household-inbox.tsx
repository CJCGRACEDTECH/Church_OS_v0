import React from "react";
import { apiJson } from "@/lib/api";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/AdminLayout";
import PageHeader from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { History, Inbox, Mail, Phone, UserRound } from "lucide-react";

type HouseholdRequestStatus = "submitted" | "reviewing" | "completed" | "declined";

type HouseholdRequest = {
  id: number;
  source: "request" | "connect_form";
  requestType: string;
  message: string;
  status: HouseholdRequestStatus;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  member: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string | null;
    streetAddress?: string | null;
    apartmentUnit?: string | null;
    city?: string | null;
    state?: string | null;
    zipCode?: string | null;
    emergencyContactName?: string | null;
    emergencyContactPhoneNumber?: string | null;
    emergencyContactRelationship?: string | null;
  };
};

type ChildLinkData = {
  linkedSpouses: Array<{
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string | null;
    profilePhotoUrl: string | null;
  }>;
  linkedChildren: Array<{
    relationshipId: number;
    childId: number;
    firstName: string;
    lastName: string;
    classroom: string | null;
    relationship: "parent" | "guardian" | "emergency_contact";
    authorizedPickup: boolean;
  }>;
  children: Array<{
    id: number;
    name: string;
    firstName: string;
    lastName: string;
    classroom: string | null;
  }>;
  members: Array<{
    id: number;
    name: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string | null;
  }>;
};

type MemberOption = {
  id: number;
  name?: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string | null;
};


function labelize(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function requestTypeLabel(value: string) {
  if (value === "connect_form") return "Connect Form";
  if (value === "account_request") return "Account Request";
  if (value === "prayer_request") return "Prayer Request";
  if (value === "family_change") return "Family Request";
  if (value === "child_link_update") return "Child Link Request";
  if (value === "pickup_authorization") return "Pickup Request";
  return labelize(value);
}

function requestTypeClass(value: string) {
  if (value === "connect_form") return "border-blue-200 bg-blue-500/10 text-blue-700";
  if (value === "account_request") return "border-amber-200 bg-amber-50 text-amber-700";
  if (value === "prayer_request") return "border-purple-200 bg-purple-50 text-purple-700";
  return "";
}

function formatDateTime(value: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusClass(status: HouseholdRequestStatus) {
  if (status === "submitted") return "border-blue-200 bg-blue-500/10 text-blue-700 dark:text-blue-300";
  if (status === "reviewing") return "border-amber-200 bg-white text-amber-700 dark:text-amber-300";
  if (status === "completed") return "border-green-200 bg-green-500/10 text-green-700 dark:text-green-300";
  return "border-slate-200 bg-slate-500/10 text-slate-700 dark:text-slate-300";
}

function inboxStatusLabel(status: HouseholdRequestStatus) {
  if (status === "submitted") return "Unread";
  if (status === "reviewing") return "Seen";
  return labelize(status);
}

function canManageFamilyLinks(request: HouseholdRequest | null) {
  if (!request) return false;
  return ["family_change", "child_link_update", "pickup_authorization"].includes(request.requestType);
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-lg border bg-white p-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function SearchSelect<T>({
  label,
  value,
  placeholder,
  options,
  getKey,
  getLabel,
  getDescription,
  onValueChange,
  onSelect,
  open,
  setOpen,
  emptyLabel,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: T[];
  getKey: (option: T) => string | number;
  getLabel: (option: T) => string;
  getDescription?: (option: T) => string | null | undefined;
  onValueChange: (value: string) => void;
  onSelect: (option: T) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  emptyLabel: string;
}) {
  const visibleOptions = options.slice(0, 8);

  return (
    <div className="relative space-y-1">
      <Label>{label}</Label>
      <Input
        value={value}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onChange={(event) => {
          onValueChange(event.target.value);
          setOpen(true);
        }}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && (
        <div className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border bg-white shadow-lg">
          {visibleOptions.length ? (
            visibleOptions.map((option) => (
              <button
                key={getKey(option)}
                type="button"
                className="block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
                onMouseDown={(event) => {
                  event.preventDefault();
                  onSelect(option);
                  setOpen(false);
                }}
              >
                <span className="block truncate font-medium text-foreground">{getLabel(option)}</span>
                {getDescription?.(option) && (
                  <span className="block truncate text-xs text-muted-foreground">{getDescription(option)}</span>
                )}
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-muted-foreground">{emptyLabel}</div>
          )}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {options.length} {options.length === 1 ? "match" : "matches"}
      </p>
    </div>
  );
}

export default function AdminHouseholdInbox() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = React.useState("");
  const [reviewRequest, setReviewRequest] = React.useState<HouseholdRequest | null>(null);
  const [childId, setChildId] = React.useState("");
  const [childRelationship, setChildRelationship] = React.useState<"parent" | "guardian" | "emergency_contact">("guardian");
  const [childPickup, setChildPickup] = React.useState(true);
  const [spouseMemberId, setSpouseMemberId] = React.useState("");
  const [spouseSearch, setSpouseSearch] = React.useState("");
  const [childSearch, setChildSearch] = React.useState("");
  const [spouseDropdownOpen, setSpouseDropdownOpen] = React.useState(false);
  const [childDropdownOpen, setChildDropdownOpen] = React.useState(false);
  const [historyOpen, setHistoryOpen] = React.useState(false);

  const requestsQuery = useQuery({
    queryKey: ["admin-inbox-requests", status],
    queryFn: () => {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      const query = params.toString();
      return apiJson<{ requests: HouseholdRequest[] }>(`/admin/household-requests${query ? `?${query}` : ""}`);
    },
  });

  const childLinksQuery = useQuery({
    queryKey: ["admin-inbox-child-links", reviewRequest?.id],
    queryFn: () => apiJson<ChildLinkData>(`/admin/household-requests/${reviewRequest?.id}/child-links`),
    enabled: canManageFamilyLinks(reviewRequest),
  });

  const memberOptionsQuery = useQuery({
    queryKey: ["admin-inbox-member-options"],
    queryFn: () => apiJson<{ members: MemberOption[] }>("/admin/members"),
    enabled: canManageFamilyLinks(reviewRequest),
  });

  const historyQuery = useQuery({
    queryKey: ["admin-inbox-history"],
    queryFn: () => apiJson<{ requests: HouseholdRequest[] }>("/admin/household-requests"),
    enabled: historyOpen,
  });

  const updateStatus = useMutation({
    mutationFn: ({ requestId, nextStatus }: { requestId: number; nextStatus: HouseholdRequestStatus }) => apiJson<{ request: { id: number; status: HouseholdRequestStatus } }>(`/admin/household-requests/${requestId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: nextStatus }),
    }),
    onSuccess: () => {
      toast({ title: "Request updated" });
      void queryClient.invalidateQueries({ queryKey: ["admin-inbox-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-inbox-history"] });
    },
    onError: (error) => toast({ title: "Could not update request", description: error.message, variant: "destructive" }),
  });

  const approveConnect = useMutation({
    mutationFn: (memberId: number) => apiJson<{ member: { id: number; email: string; invitedAt: string | null }; inviteSent: boolean; inviteUrl: string | null }>(`/admin/connect-submissions/${memberId}/approve-invite`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
    onSuccess: () => {
      toast({ title: "Invite sent", description: "The Connect form was approved and the member invitation was sent." });
      setReviewRequest(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-inbox-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-inbox-history"] });
    },
    onError: (error) => toast({ title: "Could not send invite", description: error.message, variant: "destructive" }),
  });

  const addChildLink = useMutation({
    mutationFn: () => apiJson<{ ok: boolean }>(`/admin/household-requests/${reviewRequest?.id}/child-links`, {
      method: "POST",
      body: JSON.stringify({
        childId: Number(childId),
        relationship: childRelationship,
        authorizedPickup: childPickup,
      }),
    }),
    onSuccess: () => {
      setChildId("");
      setChildSearch("");
      setChildRelationship("guardian");
      setChildPickup(true);
      toast({ title: "Child link added" });
      void queryClient.invalidateQueries({ queryKey: ["admin-inbox-child-links", reviewRequest?.id] });
    },
    onError: (error) => toast({ title: "Could not add child link", description: error.message, variant: "destructive" }),
  });

  const updateChildLink = useMutation({
    mutationFn: ({ relationshipId, relationship, authorizedPickup }: { relationshipId: number; relationship: string; authorizedPickup: boolean }) =>
      apiJson<{ ok: boolean }>(`/admin/household-requests/${reviewRequest?.id}/child-links/${relationshipId}`, {
        method: "PATCH",
        body: JSON.stringify({ relationship, authorizedPickup }),
      }),
    onSuccess: () => {
      toast({ title: "Child link updated" });
      void queryClient.invalidateQueries({ queryKey: ["admin-inbox-child-links", reviewRequest?.id] });
    },
    onError: (error) => toast({ title: "Could not update child link", description: error.message, variant: "destructive" }),
  });

  const removeChildLink = useMutation({
    mutationFn: (relationshipId: number) => apiJson<void>(`/admin/household-requests/${reviewRequest?.id}/child-links/${relationshipId}`, {
      method: "DELETE",
    }),
    onSuccess: () => {
      toast({ title: "Child link removed" });
      void queryClient.invalidateQueries({ queryKey: ["admin-inbox-child-links", reviewRequest?.id] });
    },
    onError: (error) => toast({ title: "Could not remove child link", description: error.message, variant: "destructive" }),
  });

  const addSpouseLink = useMutation({
    mutationFn: () => apiJson<{ ok: boolean }>(`/admin/household-requests/${reviewRequest?.id}/spouse-link`, {
      method: "POST",
      body: JSON.stringify({ spouseMemberId: Number(spouseMemberId) }),
    }),
    onSuccess: () => {
      setSpouseMemberId("");
      setSpouseSearch("");
      toast({ title: "Spouse linked" });
      void queryClient.invalidateQueries({ queryKey: ["admin-inbox-child-links", reviewRequest?.id] });
    },
    onError: (error) => toast({ title: "Could not link spouse", description: error.message, variant: "destructive" }),
  });

  const removeSpouseLink = useMutation({
    mutationFn: (memberId: number) => apiJson<void>(`/admin/household-requests/${reviewRequest?.id}/spouse-link/${memberId}`, {
      method: "DELETE",
    }),
    onSuccess: () => {
      toast({ title: "Spouse link removed" });
      void queryClient.invalidateQueries({ queryKey: ["admin-inbox-child-links", reviewRequest?.id] });
    },
    onError: (error) => toast({ title: "Could not remove spouse link", description: error.message, variant: "destructive" }),
  });

  function openReviewModal(request: HouseholdRequest) {
    const openedRequest = request.status === "submitted" ? { ...request, status: "reviewing" as const } : request;
    setReviewRequest(openedRequest);
    if (request.status === "submitted") {
      updateStatus.mutate({ requestId: request.id, nextStatus: "reviewing" });
    }
  }

  function applyDecision(nextStatus: "completed" | "declined") {
    if (!reviewRequest) return;
    setReviewRequest({ ...reviewRequest, status: nextStatus });
    updateStatus.mutate(
      { requestId: reviewRequest.id, nextStatus },
      {
        onSuccess: () => {
          setReviewRequest(null);
        },
      },
    );
  }

  const requests = requestsQuery.data?.requests ?? [];
  const matchesSearch = (parts: Array<string | null | undefined>, search: string) => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return true;
    return parts.filter(Boolean).join(" ").toLowerCase().includes(normalizedSearch);
  };
  const spouseOptions = React.useMemo(() => {
    const fromFamilyLinks = childLinksQuery.data?.members ?? [];
    const fromDirectory = (memberOptionsQuery.data?.members ?? [])
      .filter((member) => member.id !== reviewRequest?.member.id)
      .map((member) => ({
        ...member,
        name: member.name ?? `${member.firstName} ${member.lastName}`.trim(),
      }));
    return fromFamilyLinks.length ? fromFamilyLinks : fromDirectory;
  }, [childLinksQuery.data?.members, memberOptionsQuery.data?.members, reviewRequest?.member.id]);
  const spouseOptionLabel = (member: MemberOption) => `${member.name ?? `${member.firstName} ${member.lastName}`.trim()} · ${member.email}${member.phoneNumber ? ` · ${member.phoneNumber}` : ""}`;
  const filteredSpouseOptions = React.useMemo(() => spouseOptions.filter((member) => matchesSearch([
    member.name,
    member.firstName,
    member.lastName,
    member.email,
    member.phoneNumber,
  ], spouseSearch)), [spouseOptions, spouseSearch]);
  const childOptions = childLinksQuery.data?.children ?? [];
  const filteredChildOptions = React.useMemo(() => childOptions.filter((child) => matchesSearch([
    child.name,
    child.firstName,
    child.lastName,
    child.classroom,
  ], childSearch)), [childOptions, childSearch]);
  const childOptionLabel = (child: ChildLinkData["children"][number]) => `${child.name}${child.classroom ? ` · ${child.classroom}` : ""}`;
  const historyItems = (historyQuery.data?.requests ?? [])
    .filter((request) => request.status === "completed" || request.status === "declined")
    .sort((a, b) => new Date(b.reviewedAt ?? b.updatedAt ?? b.createdAt).getTime() - new Date(a.reviewedAt ?? a.updatedAt ?? a.createdAt).getTime());

  return (
    <AdminLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader
          eyebrow="Messages"
          title="Inbox"
          description="Connect forms, family requests, and prayer requests."
          icon={<Inbox className="h-6 w-6" />}
          actions={
            <Button variant="outline" className="bg-white" onClick={() => setHistoryOpen(true)}>
              <History className="mr-2 h-4 w-4" />
              Change History
            </Button>
          }
        />

        <Card>
          <CardHeader className="gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle>Messages</CardTitle>
            </div>
            <div className="space-y-2 md:w-56">
              <Label>Status</Label>
              <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">All messages</option>
                <option value="submitted">Unread</option>
                <option value="reviewing">Seen</option>
                <option value="completed">Completed</option>
                <option value="declined">Declined</option>
              </select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead>Request</TableHead>
                    <TableHead>Received</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request) => {
                    const unread = request.status === "submitted";
                    return (
                    <TableRow key={`${request.source}-${request.id}`} className={`align-top ${unread ? "border-l-4 border-l-blue-500 bg-blue-50/60" : ""}`}>
                      <TableCell className="pt-5">
                        <span className={`block h-2.5 w-2.5 rounded-full ${unread ? "bg-blue-600" : "bg-slate-300"}`} aria-label={unread ? "Unread request" : "Seen request"} />
                      </TableCell>
                      <TableCell className="min-w-56">
                        <div className="space-y-2">
                          <Link href={`/admin/members/${request.member.id}`} className={`flex items-center gap-2 text-primary hover:underline ${unread ? "font-semibold" : "font-medium"}`}>
                            <UserRound className="h-4 w-4" />
                            {request.member.firstName} {request.member.lastName}
                          </Link>
                          <div className="space-y-1 text-xs text-muted-foreground">
                            <p className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{request.member.email}</p>
                            {request.member.phoneNumber && <p className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{request.member.phoneNumber}</p>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xl">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            {unread && <Badge className="bg-blue-600 text-white hover:bg-blue-600">New</Badge>}
                            <Badge variant="outline" className={statusClass(request.status)}>{inboxStatusLabel(request.status)}</Badge>
                            <Badge variant="outline" className={requestTypeClass(request.requestType)}>{requestTypeLabel(request.requestType)}</Badge>
                          </div>
                          <p className={`whitespace-pre-wrap text-sm ${unread ? "font-medium text-foreground" : "text-muted-foreground"}`}>{request.message}</p>
                          {request.reviewedAt && <p className="text-xs text-muted-foreground">Last reviewed {formatDateTime(request.reviewedAt)}</p>}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDateTime(request.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant={unread ? "default" : "outline"} onClick={() => openReviewModal(request)}>
                          Open
                        </Button>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                  {!requests.length && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                        {requestsQuery.isLoading ? "Loading inbox items..." : "No inbox items found."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
          <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-4xl flex-col overflow-hidden p-0">
            <DialogHeader className="border-b px-6 py-4">
              <DialogTitle>Change History</DialogTitle>
              <DialogDescription>Completed and declined inbox items are kept here for review.</DialogDescription>
            </DialogHeader>
            <div className="min-h-0 overflow-y-auto p-6">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Request</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyItems.map((request) => (
                      <TableRow key={`history-${request.source}-${request.id}`}>
                        <TableCell>
                          <div className="font-medium">{request.member.firstName} {request.member.lastName}</div>
                          <div className="text-xs text-muted-foreground">{request.member.email}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={requestTypeClass(request.requestType)}>{requestTypeLabel(request.requestType)}</Badge>
                          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{request.message}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusClass(request.status)}>{labelize(request.status)}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDateTime(request.reviewedAt ?? request.updatedAt)}</TableCell>
                      </TableRow>
                    ))}
                    {!historyItems.length && (
                      <TableRow>
                        <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                          {historyQuery.isLoading ? "Loading change history..." : "No completed inbox history yet."}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={Boolean(reviewRequest)} onOpenChange={(open) => !open && setReviewRequest(null)}>
          <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-4xl flex-col overflow-hidden p-0">
            <DialogHeader className="border-b px-6 py-4">
              <DialogTitle>Inbox Message</DialogTitle>
              <DialogDescription>Review the message and take action.</DialogDescription>
            </DialogHeader>

            <div className="min-h-0 overflow-y-auto px-6 py-5">
              {reviewRequest && (
                <div className="space-y-5">
                  <div className="grid gap-4 lg:grid-cols-[1fr_16rem]">
                    <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">Message</p>
                          <h3 className="mt-1 truncate text-lg font-semibold">{requestTypeLabel(reviewRequest.requestType)}</h3>
                          <p className="mt-1 text-sm text-muted-foreground">{formatDateTime(reviewRequest.createdAt)}</p>
                        </div>
                        <Badge variant="outline" className={statusClass(reviewRequest.status)}>{inboxStatusLabel(reviewRequest.status)}</Badge>
                      </div>
                      <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50/70 p-4">
                        <p className="whitespace-pre-wrap text-sm leading-6">{reviewRequest.message}</p>
                      </div>
                    </section>

                    <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">Member</p>
                      <div className="mt-3 space-y-2">
                        <p className="font-semibold">{reviewRequest.member.firstName} {reviewRequest.member.lastName}</p>
                        <p className="break-all text-sm text-muted-foreground">{reviewRequest.member.email}</p>
                        {reviewRequest.member.phoneNumber && <p className="text-sm text-muted-foreground">{reviewRequest.member.phoneNumber}</p>}
                      </div>
                      <Button asChild variant="outline" className="mt-4 w-full">
                        <Link href={`/admin/members/${reviewRequest.member.id}`}>View Profile</Link>
                      </Button>
                    </section>
                  </div>

                  {canManageFamilyLinks(reviewRequest) && (
                  <FormSection title="Family Links" description="Link spouses first, then manage children and pickup authorization.">
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium">Spouse</p>
                        <p className="text-xs text-muted-foreground">For married couples, link both spouses so each household shows the other spouse and shared children.</p>
                      </div>
                      {childLinksQuery.isLoading ? (
                        <p className="text-sm text-muted-foreground">Loading family links...</p>
                      ) : (childLinksQuery.data?.linkedSpouses ?? []).length ? (
                        (childLinksQuery.data?.linkedSpouses ?? []).map((spouse) => (
                          <div key={spouse.id} className="rounded-md border bg-white p-3">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="font-medium">{spouse.firstName} {spouse.lastName}</p>
                                <p className="text-xs text-muted-foreground">{spouse.email}{spouse.phoneNumber ? ` · ${spouse.phoneNumber}` : ""}</p>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={removeSpouseLink.isPending}
                                onClick={() => {
                                  if (window.confirm(`Remove spouse link for ${spouse.firstName} ${spouse.lastName}?`)) {
                                    removeSpouseLink.mutate(spouse.id);
                                  }
                                }}
                              >
                                Remove Spouse
                              </Button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="rounded-md border bg-white p-3 text-sm text-muted-foreground">No spouse linked yet.</p>
                      )}

                      <div className="grid gap-3 rounded-md border bg-white p-3 sm:grid-cols-[minmax(0,1fr)_9.5rem] sm:items-start">
                        <SearchSelect
                          label="Spouse"
                          value={spouseSearch}
                          placeholder="Search members"
                          options={filteredSpouseOptions}
                          getKey={(member) => member.id}
                          getLabel={(member) => member.name ?? `${member.firstName} ${member.lastName}`.trim()}
                          getDescription={(member) => `${member.email}${member.phoneNumber ? ` · ${member.phoneNumber}` : ""}`}
                          onValueChange={(value) => {
                            setSpouseSearch(value);
                            setSpouseMemberId("");
                          }}
                          onSelect={(member) => {
                            setSpouseSearch(spouseOptionLabel(member));
                            setSpouseMemberId(String(member.id));
                          }}
                          open={spouseDropdownOpen}
                          setOpen={setSpouseDropdownOpen}
                          emptyLabel="No members found"
                        />
                        <Button type="button" className="mt-6 h-10 w-full" disabled={!spouseMemberId || addSpouseLink.isPending} onClick={() => addSpouseLink.mutate()}>
                          Link Spouse
                        </Button>
                      </div>
                    </div>

                    <div className="mt-5 space-y-3 border-t pt-5">
                      <div>
                        <p className="text-sm font-medium">Children & Pickup Authorization</p>
                        <p className="text-xs text-muted-foreground">Children linked to either spouse will appear in the household.</p>
                      </div>
                    <div className="space-y-3">
                      {childLinksQuery.isLoading ? (
                        <p className="text-sm text-muted-foreground">Loading child links...</p>
                      ) : (childLinksQuery.data?.linkedChildren ?? []).length ? (
                        (childLinksQuery.data?.linkedChildren ?? []).map((link) => (
                          <div key={link.relationshipId} className="rounded-md border bg-white p-3">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                              <div>
                                <p className="font-medium">{link.firstName} {link.lastName}</p>
                                <p className="text-xs text-muted-foreground">{link.classroom ?? "No classroom"}</p>
                              </div>
                              <div className="grid gap-2 sm:grid-cols-[10rem_9rem_auto]">
                                <select
                                  value={link.relationship}
                                  onChange={(event) => updateChildLink.mutate({
                                    relationshipId: link.relationshipId,
                                    relationship: event.target.value,
                                    authorizedPickup: link.authorizedPickup,
                                  })}
                                  className="h-9 rounded-md border bg-background px-3 text-sm"
                                >
                                  <option value="parent">Parent</option>
                                  <option value="guardian">Guardian</option>
                                  <option value="emergency_contact">Emergency Contact</option>
                                </select>
                                <select
                                  value={link.authorizedPickup ? "true" : "false"}
                                  onChange={(event) => updateChildLink.mutate({
                                    relationshipId: link.relationshipId,
                                    relationship: link.relationship,
                                    authorizedPickup: event.target.value === "true",
                                  })}
                                  className="h-9 rounded-md border bg-background px-3 text-sm"
                                >
                                  <option value="true">Pickup OK</option>
                                  <option value="false">No pickup</option>
                                </select>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={removeChildLink.isPending}
                                  onClick={() => {
                                    if (window.confirm(`Remove ${link.firstName} ${link.lastName} from this member's child links?`)) {
                                      removeChildLink.mutate(link.relationshipId);
                                    }
                                  }}
                                >
                                  Remove
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="rounded-md border bg-white p-3 text-sm text-muted-foreground">No child links found for this member.</p>
                      )}
                    </div>

                    <div className="grid gap-3 rounded-md border bg-white p-3 lg:grid-cols-[minmax(0,1fr)_11rem_9rem_8rem] lg:items-start">
                      <SearchSelect
                        label="Child"
                        value={childSearch}
                        placeholder="Search children"
                        options={filteredChildOptions}
                        getKey={(child) => child.id}
                        getLabel={(child) => child.name}
                        getDescription={(child) => child.classroom ?? "No classroom"}
                        onValueChange={(value) => {
                          setChildSearch(value);
                          setChildId("");
                        }}
                        onSelect={(child) => {
                          setChildSearch(childOptionLabel(child));
                          setChildId(String(child.id));
                        }}
                        open={childDropdownOpen}
                        setOpen={setChildDropdownOpen}
                        emptyLabel="No children found"
                      />
                      <div className="space-y-1">
                        <Label>Relationship</Label>
                        <select value={childRelationship} onChange={(event) => setChildRelationship(event.target.value as typeof childRelationship)} className="h-10 w-full min-w-0 rounded-md border bg-background px-3 text-sm">
                          <option value="parent">Parent</option>
                          <option value="guardian">Guardian</option>
                          <option value="emergency_contact">Emergency Contact</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label>Pickup</Label>
                        <select value={childPickup ? "true" : "false"} onChange={(event) => setChildPickup(event.target.value === "true")} className="h-10 w-full min-w-0 rounded-md border bg-background px-3 text-sm">
                          <option value="true">Pickup OK</option>
                          <option value="false">No pickup</option>
                        </select>
                      </div>
                      <Button type="button" className="mt-6 h-10 w-full" disabled={!childId || addChildLink.isPending} onClick={() => addChildLink.mutate()}>
                        Add Link
                      </Button>
                    </div>
                    </div>
                  </FormSection>
                  )}
                </div>
              )}
            </div>

            {reviewRequest && (
              <div className="border-t bg-slate-50 px-6 py-4">
                <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
                  <div className="space-y-2">
                    <Label>Resolution</Label>
                    <div className="rounded-md border bg-white px-3 py-2 text-sm text-muted-foreground">
                      Close without action to keep this message marked as seen.
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        disabled={updateStatus.isPending}
                        onClick={() => applyDecision("completed")}
                      >
                        {updateStatus.isPending ? "Saving..." : "Mark Resolved"}
                      </Button>
                      <Button
                        disabled={updateStatus.isPending}
                        onClick={() => applyDecision("declined")}
                        variant="outline"
                      >
                        Decline
                      </Button>
                      <Button variant="outline" onClick={() => setReviewRequest(null)}>Close</Button>
                  </div>
                </div>
                {(reviewRequest.requestType === "connect_form" || reviewRequest.requestType === "account_request") && (
                  <div className="mt-3 rounded-md border border-blue-100 bg-white p-3">
                    <p className="text-xs font-medium text-muted-foreground">{requestTypeLabel(reviewRequest.requestType)}</p>
                    <Button
                      size="sm"
                      disabled={approveConnect.isPending}
                      onClick={() => approveConnect.mutate(reviewRequest.member.id)}
                      className="mt-2 bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      {approveConnect.isPending ? "Sending..." : "Approve Member & Send Invite"}
                    </Button>
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
