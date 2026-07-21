import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/AdminLayout";
import PageHeader from "@/components/PageHeader";
import SearchableSelect from "@/components/SearchableSelect";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { readProfilePhotoFile } from "@/lib/profile-photo";
import { CalendarCheck, ChevronDown, CircleHelp, History, LogOut, Pencil, Plus, ShieldCheck, Trash2, UserRound, X } from "lucide-react";

type Guardian = {
  id: number;
  name: string;
  email: string | null;
  phoneNumber: string | null;
  relationship: "parent" | "guardian" | "emergency_contact";
  authorizedPickup: boolean;
};

type Child = {
  id: number;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  age: number | null;
  gender: string | null;
  profilePhotoUrl: string | null;
  allergyInformation: string | null;
  medicalNotes: string | null;
  specialInstructions: string | null;
  classroom: string | null;
  checkinStatus: "checked_in" | "checked_out";
  guardians: Guardian[];
  activeCheckIn: {
    id: number;
    checkinTime: string;
    classroom: string | null;
    checkedInByUserId: number;
  } | null;
};

type MinistryCheckinHistoryRecord = {
  id: number;
  childId: number;
  childName: string;
  checkinTime: string;
  checkoutTime: string | null;
  classroom: string | null;
  status: "active" | "checked_out";
  checkedInByName: string;
  checkedOutByName: string | null;
  pickedUpByName: string | null;
};

type MemberContact = {
  id: number;
  name: string;
  email: string;
  phoneNumber: string | null;
};

async function apiJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(options?.headers ?? {}),
    },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "Request failed");
  return data as T;
}

function relationshipLabel(value: string) {
  if (value === "emergency_contact") return "Emergency Contact";
  return value[0].toUpperCase() + value.slice(1);
}

function childName(child: Child) {
  return `${child.firstName} ${child.lastName}`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function dateGroupKey(value: string) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function AdminCheckIn() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [selectedChildId, setSelectedChildId] = React.useState<number | null>(null);
  const [registerOpen, setRegisterOpen] = React.useState(false);
  const [activeExpanded, setActiveExpanded] = React.useState(false);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [pickupCodeDisplay, setPickupCodeDisplay] = React.useState<{ childName: string; code: string } | null>(null);

  const childrenQuery = useQuery({
    queryKey: ["children-checkin"],
    queryFn: () => apiJson<{ children: Child[] }>("/admin/checkin/children"),
  });

  const historyQuery = useQuery({
    queryKey: ["children-checkin-history"],
    queryFn: () => apiJson<{ history: MinistryCheckinHistoryRecord[] }>("/admin/checkin/history"),
  });

  const memberContactsQuery = useQuery({
    queryKey: ["children-ministry-member-contacts"],
    queryFn: () => apiJson<{ members: MemberContact[] }>("/admin/checkin/member-contacts"),
  });

  const children = childrenQuery.data?.children ?? [];
  const checkinHistory = historyQuery.data?.history ?? [];
  const filteredChildren = children.filter((child) => {
    const needle = search.trim().toLowerCase();
    if (!needle) return true;
    return `${child.firstName} ${child.lastName} ${child.classroom ?? ""}`.toLowerCase().includes(needle);
  });
  const activeChildren = children.filter((child) => child.checkinStatus === "checked_in");
  const selectedChild = selectedChildId ? children.find((child) => child.id === selectedChildId) ?? null : null;
  const todayKey = dateGroupKey(new Date().toISOString());
  const todaysCheckins = checkinHistory.filter((record) => dateGroupKey(record.checkinTime) === todayKey);
  const activeClassrooms = new Set(activeChildren.map((child) => child.activeCheckIn?.classroom || child.classroom || "Unassigned"));
  const pickupContacts = children.reduce((sum, child) => sum + child.guardians.filter((guardian) => guardian.authorizedPickup).length, 0);

  React.useEffect(() => {
    if (activeChildren.length > 0) setActiveExpanded(true);
  }, [activeChildren.length]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["children-checkin"] });
    void queryClient.invalidateQueries({ queryKey: ["children-checkin-history"] });
  };

  const registerChild = useMutation({
    mutationFn: (formData: FormData) => apiJson<{ child: Child }>("/admin/checkin/children", {
      method: "POST",
      body: JSON.stringify(formPayload(formData)),
    }),
    onSuccess: (data) => {
      setRegisterOpen(false);
      setSelectedChildId(data.child.id);
      toast({ title: "Child registered" });
      void refresh();
    },
    onError: (error) => toast({ title: "Could not register child", description: error.message, variant: "destructive" }),
  });

  const checkIn = useMutation({
    mutationFn: (child: Child) => apiJson<{ child: Child; pickupCode: string }>(`/admin/checkin/children/${child.id}/check-in`, {
      method: "POST",
      body: JSON.stringify({ classroom: child.classroom }),
    }),
    onSuccess: (data, child) => {
      setSelectedChildId(data.child.id);
      setPickupCodeDisplay({ childName: `${child.firstName} ${child.lastName}`, code: data.pickupCode });
      void refresh();
    },
    onError: (error) => toast({ title: "Check-in failed", description: error.message, variant: "destructive" }),
  });

  const checkOut = useMutation({
    mutationFn: ({ childId, guardianId, pickupCode }: { childId: number; guardianId: number; pickupCode: string }) =>
      apiJson<{ child: Child }>(`/admin/checkin/children/${childId}/check-out`, {
        method: "POST",
        body: JSON.stringify({ guardianId, pickupCode }),
      }),
    onSuccess: (data) => {
      setSelectedChildId(data.child.id);
      toast({ title: "Child checked out" });
      void refresh();
    },
    onError: (error) => toast({ title: "Check-out failed", description: error.message, variant: "destructive" }),
  });

  const removeActiveCheckIn = useMutation({
    mutationFn: (childId: number) =>
      apiJson<{ child: Child }>(`/admin/checkin/children/${childId}/active-check-in`, {
        method: "DELETE",
      }),
    onSuccess: (data) => {
      setSelectedChildId(data.child.id);
      toast({ title: "Accidental check-in removed" });
      void refresh();
    },
    onError: (error) => toast({ title: "Could not remove check-in", description: error.message, variant: "destructive" }),
  });

  const updateChild = useMutation({
    mutationFn: ({ childId, formData }: { childId: number; formData: FormData }) =>
      apiJson<{ child: Child }>(`/admin/checkin/children/${childId}`, {
        method: "PATCH",
        body: JSON.stringify(formPayload(formData)),
      }),
    onSuccess: (data) => {
      setSelectedChildId(data.child.id);
      toast({ title: "Child profile updated" });
      void refresh();
    },
    onError: (error) => toast({ title: "Could not update child", description: error.message, variant: "destructive" }),
  });

  const addGuardian = useMutation({
    mutationFn: ({ childId, formData }: { childId: number; formData: FormData }) =>
      apiJson<{ child: Child }>(`/admin/checkin/children/${childId}/guardians`, {
        method: "POST",
        body: JSON.stringify(formPayload(formData)),
      }),
    onSuccess: (data) => {
      setSelectedChildId(data.child.id);
      toast({ title: "Pickup contact added" });
      void refresh();
    },
    onError: (error) => toast({ title: "Could not add pickup contact", description: error.message, variant: "destructive" }),
  });

  return (
    <AdminLayout>
      {pickupCodeDisplay && (
        <Dialog open onOpenChange={(open) => { if (!open) setPickupCodeDisplay(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-green-600" />
                Child Checked In
              </DialogTitle>
              <DialogDescription>
                Give this security code to the pickup family for <strong>{pickupCodeDisplay.childName}</strong>. It will be required at check-out.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="rounded-lg border-2 border-green-200 bg-green-50 px-8 py-4 text-center">
                <p className="text-xs font-semibold uppercase tracking-widest text-green-700 mb-1">Pickup Security Code</p>
                <p className="text-4xl font-mono font-bold tracking-widest text-green-800">{pickupCodeDisplay.code}</p>
              </div>
              <p className="text-xs text-muted-foreground text-center">Keep this code private. Staff will ask for it when the child is picked up.</p>
            </div>
            <DialogFooter>
              <Button onClick={() => setPickupCodeDisplay(null)}>Done</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader
          eyebrow="Children Ministry"
          title="Children Ministry"
          description="Register children, manage pickup contacts, and track active check-ins."
          icon={<UserRound className="h-6 w-6" />}
          actions={
          <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <History className="h-4 w-4" />
                Check-In History
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[88vh] max-w-6xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Check-In History</DialogTitle>
                <DialogDescription>Review Children Ministry attendance by date, child, classroom, and check-in person.</DialogDescription>
              </DialogHeader>
              <MinistryCheckinHistory records={checkinHistory} isLoading={historyQuery.isLoading} expanded onExpandedChange={() => undefined} />
            </DialogContent>
          </Dialog>
          }
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={UserRound} label="Registered Children" value={String(children.length)} tooltip="Total children currently registered in Children Ministry." />
          <MetricCard icon={CalendarCheck} label="Checked In Now" value={String(activeChildren.length)} tooltip="Children currently checked in and waiting for authorized pickup." />
          <MetricCard icon={History} label="Today's Check-ins" value={String(todaysCheckins.length)} tooltip="Total Children Ministry check-ins recorded today, including children already checked out." />
          <MetricCard icon={ShieldCheck} label="Pickup Contacts" value={String(pickupContacts)} tooltip="Authorized pickup contacts linked across all child profiles." />
        </div>

        {activeChildren.length > 0 && (
          <div className="flex flex-wrap gap-2 rounded-md border bg-muted/20 p-3 text-sm">
            <span className="font-medium">Active classrooms:</span>
            {[...activeClassrooms].map((room) => <Badge key={room} variant="secondary">{room}</Badge>)}
          </div>
        )}

        <Collapsible open={activeExpanded} onOpenChange={setActiveExpanded}>
          <Card>
            <CardHeader>
              <CollapsibleTrigger asChild>
                <button type="button" className="flex w-full items-start justify-between gap-4 text-left">
                  <div>
                    <CardTitle>Active Check-ins</CardTitle>
                    <CardDescription>Children currently checked in and awaiting authorized pickup.</CardDescription>
                  </div>
                  <ChevronDown className={`mt-1 h-4 w-4 text-muted-foreground transition-transform ${activeExpanded ? "rotate-180" : ""}`} />
                </button>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent>
            {activeChildren.length > 0 ? (
              <>
                {(() => {
                  const classroomGroups = activeChildren.reduce<Record<string, number>>((acc, child) => {
                    const room = child.activeCheckIn?.classroom || child.classroom || "Unassigned";
                    acc[room] = (acc[room] ?? 0) + 1;
                    return acc;
                  }, {});
                  return (
                    <div className="mb-4 flex flex-wrap gap-2">
                      {Object.entries(classroomGroups).map(([room, count]) => (
                        <Badge key={room} variant="secondary">{room}: {count}</Badge>
                      ))}
                    </div>
                  );
                })()}
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {activeChildren.map((child) => (
                    <div key={child.id} className="rounded-md border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <ChildAvatar child={child} />
                          <div className="min-w-0">
                            <p className="truncate font-medium">{childName(child)}</p>
                            <p className="truncate text-sm text-muted-foreground">
                              {child.activeCheckIn?.classroom || child.classroom || "Unassigned"}
                            </p>
                            {child.activeCheckIn?.checkinTime && (
                              <p className="text-xs text-muted-foreground">
                                In at {new Date(child.activeCheckIn.checkinTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            )}
                          </div>
                        </div>
                        <CheckoutDialog child={child} isPending={checkOut.isPending} onCheckout={(guardianId, pickupCode) => checkOut.mutate({ childId: child.id, guardianId, pickupCode })} />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                No active check-ins yet.
              </div>
            )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        <div className="grid gap-6">
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Children List</CardTitle>
                <CardDescription>Search the database, select a child, and manage their profile inline.</CardDescription>
              </div>
              <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus />
                    Register Child
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Register Child</DialogTitle>
                    <DialogDescription>Add a child profile and one parent or guardian contact.</DialogDescription>
                  </DialogHeader>
                  <ChildRegistrationForm
                    memberContacts={memberContactsQuery.data?.members ?? []}
                    isPending={registerChild.isPending}
                    onSubmit={(formData) => registerChild.mutate(formData)}
                  />
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by child name or classroom"
              />
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Child</TableHead>
                    <TableHead>Age</TableHead>
                    <TableHead>Classroom</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredChildren.map((child) => {
                    const isExpanded = selectedChild?.id === child.id;
                    return (
                      <React.Fragment key={child.id}>
                        <TableRow
                          className={isExpanded ? "bg-muted/50" : ""}
                          onClick={() => setSelectedChildId(isExpanded ? null : child.id)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <ChildAvatar child={child} />
                              <div>
                                <div className="font-medium">{childName(child)}</div>
                                <div className="text-xs text-muted-foreground">
                                  {child.allergyInformation ? `Allergies: ${child.allergyInformation}` : "No allergies listed"}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{child.age ?? "N/A"}</TableCell>
                          <TableCell>{child.classroom || "Unassigned"}</TableCell>
                          <TableCell>
                            <Badge variant={child.checkinStatus === "checked_in" ? "default" : "secondary"}>
                              {child.checkinStatus === "checked_in" ? "Checked In" : "Checked Out"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setSelectedChildId(isExpanded ? null : child.id);
                                }}
                              >
                                {isExpanded ? "Hide" : "Details"}
                              </Button>
                              {child.checkinStatus === "checked_in" ? (
                                <CheckoutDialog child={child} isPending={checkOut.isPending} onCheckout={(guardianId, pickupCode) => checkOut.mutate({ childId: child.id, guardianId, pickupCode })} />
                              ) : (
                                <CheckinConfirmDialog child={child} isPending={checkIn.isPending} onConfirm={() => checkIn.mutate(child)} />
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow className="bg-muted/20 hover:bg-muted/20">
                            <TableCell colSpan={5} className="p-4">
                              <ChildProfileDetails
                                child={child}
                                isUpdating={updateChild.isPending}
                                isAddingGuardian={addGuardian.isPending}
                                isRemovingCheckIn={removeActiveCheckIn.isPending}
                                onUpdate={(formData) => updateChild.mutateAsync({ childId: child.id, formData }).then(() => undefined)}
                                onAddGuardian={(formData) => addGuardian.mutateAsync({ childId: child.id, formData }).then(() => undefined)}
                                onRemoveActiveCheckIn={() => removeActiveCheckIn.mutate(child.id)}
                              />
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
              {filteredChildren.length === 0 && (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  {children.length === 0 ? (
                    <span>
                      No children registered yet.{" "}
                      <button
                        onClick={() => setRegisterOpen(true)}
                        className="text-primary underline underline-offset-2"
                      >
                        Register a child
                      </button>{" "}
                      to start checking them in.
                    </span>
                  ) : (
                    "No children match that search."
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}

function ChildProfileDetails({
  child,
  isUpdating,
  isAddingGuardian,
  isRemovingCheckIn,
  onUpdate,
  onAddGuardian,
  onRemoveActiveCheckIn,
}: {
  child: Child;
  isUpdating: boolean;
  isAddingGuardian: boolean;
  isRemovingCheckIn: boolean;
  onUpdate: (formData: FormData) => Promise<void>;
  onAddGuardian: (formData: FormData) => Promise<void>;
  onRemoveActiveCheckIn: () => void;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ChildAvatar child={child} size="lg" />
            <div>
              <h2 className="text-xl font-semibold">{childName(child)}</h2>
              <p className="text-sm text-muted-foreground">
                {child.age !== null ? `${child.age} years old` : "Age not listed"} · {child.classroom || "No classroom"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={child.checkinStatus === "checked_in" ? "default" : "secondary"}>
              {child.checkinStatus === "checked_in" ? "Checked In" : "Checked Out"}
            </Badge>
            <EditChildProfileDialog
              child={child}
              isUpdating={isUpdating}
              isAddingGuardian={isAddingGuardian}
              onUpdate={onUpdate}
              onAddGuardian={onAddGuardian}
            />
          </div>
        </div>

        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <Info label="Date of Birth" value={child.dateOfBirth || "Not listed"} />
          <Info label="Gender" value={child.gender || "Not listed"} />
          <Info label="Allergy Information" value={child.allergyInformation || "None listed"} />
          <Info label="Medical Notes" value={child.medicalNotes || "None listed"} />
          <Info label="Special Instructions" value={child.specialInstructions || "None listed"} />
        </div>

        {child.checkinStatus === "checked_in" && child.activeCheckIn && (
          <Collapsible>
            <div className="rounded-md border bg-muted/20 p-3">
              <CollapsibleTrigger asChild>
                <button type="button" className="flex w-full items-center justify-between text-left text-sm font-medium text-muted-foreground">
                  Correction tools
                  <ChevronDown className="h-4 w-4" />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3 space-y-3">
                <div className="rounded-md border border-destructive/20 bg-background p-3">
                  <p className="text-sm font-medium">Accidental check-in</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Use this only if the child was checked in by mistake. Normal pickup should use Check Out.
                  </p>
                  <RemoveCheckInConfirmDialog
                    child={child}
                    isPending={isRemovingCheckIn}
                    onConfirm={onRemoveActiveCheckIn}
                  />
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <p className="mb-2 text-sm font-medium">Parent / Guardian Relationships</p>
          <div className="space-y-2">
            {child.guardians.length > 0 ? (
              child.guardians.map((guardian) => (
                <div key={guardian.id} className="rounded-md border bg-background p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{guardian.name}</p>
                      <p className="text-muted-foreground">
                        {relationshipLabel(guardian.relationship)} · {guardian.phoneNumber || "No phone"}
                      </p>
                    </div>
                    <Badge variant={guardian.authorizedPickup ? "secondary" : "outline"}>
                      {guardian.authorizedPickup ? "Pickup OK" : "No pickup"}
                    </Badge>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-md border border-dashed bg-background p-3 text-sm text-muted-foreground">
                No pickup contacts listed.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function RemoveCheckInConfirmDialog({
  child,
  isPending,
  onConfirm,
}: {
  child: Child;
  isPending: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="mt-3 border-destructive/30 text-destructive hover:bg-destructive/10">
          <Trash2 className="h-4 w-4" />
          Remove Accidental Check-In
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove this check-in?</AlertDialogTitle>
          <AlertDialogDescription>
            This will remove the active check-in for {childName(child)} and mark the child as checked out. Use this only for accidental check-ins, not normal pickup.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          <p className="font-medium">{childName(child)}</p>
          <p className="text-xs text-muted-foreground">
            Checked in at {child.activeCheckIn?.checkinTime ? formatDateTime(child.activeCheckIn.checkinTime) : "unknown time"}
          </p>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? "Removing..." : "Yes, Remove Check-In"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function MinistryCheckinHistory({
  records,
  isLoading,
  expanded,
  onExpandedChange,
}: {
  records: MinistryCheckinHistoryRecord[];
  isLoading: boolean;
  expanded: boolean;
  onExpandedChange: (open: boolean) => void;
}) {
  const [nameSearch, setNameSearch] = React.useState("");
  const [fromDate, setFromDate] = React.useState("");
  const [toDate, setToDate] = React.useState("");

  const filteredByFilters = React.useMemo(() => {
    return records.filter((record) => {
      if (nameSearch.trim() && !record.childName.toLowerCase().includes(nameSearch.trim().toLowerCase())) return false;
      if (fromDate && new Date(record.checkinTime) < new Date(fromDate)) return false;
      if (toDate && new Date(record.checkinTime) > new Date(`${toDate}T23:59:59`)) return false;
      return true;
    });
  }, [records, nameSearch, fromDate, toDate]);

  const groupedRecords = React.useMemo(() => {
    const groups = new Map<string, MinistryCheckinHistoryRecord[]>();

    filteredByFilters.forEach((record) => {
      const key = dateGroupKey(record.checkinTime);
      groups.set(key, [...(groups.get(key) ?? []), record]);
    });

    return Array.from(groups.entries()).map(([date, dateRecords]) => ({
      date,
      label: formatDate(dateRecords[0]?.checkinTime ?? date),
      records: dateRecords,
      activeCount: dateRecords.filter((record) => record.status === "active").length,
    }));
  }, [filteredByFilters]);

  return (
    <Collapsible open={expanded} onOpenChange={onExpandedChange}>
      <Card>
        <CardHeader>
          <CollapsibleTrigger asChild>
            <button type="button" className="flex w-full items-start justify-between gap-4 text-left">
              <div>
                <div className="flex items-center gap-2">
                  <History className="h-5 w-5 text-primary" />
                  <CardTitle>Check-In History</CardTitle>
                </div>
                <CardDescription>Attendance log for Children Ministry by date, time, child, and check-in person.</CardDescription>
              </div>
              <ChevronDown className={`mt-1 h-4 w-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
            </button>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_160px_160px]">
          <div className="relative">
            <Input
              placeholder="Search by child name"
              value={nameSearch}
              onChange={(event) => setNameSearch(event.target.value)}
              className="pl-3"
            />
          </div>
          <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} title="From date" />
          <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} title="To date" />
        </div>
        {isLoading ? (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Loading check-in history...
          </div>
        ) : groupedRecords.length > 0 ? (
          <Accordion type="single" collapsible defaultValue={groupedRecords[0]?.date} className="space-y-3">
            {groupedRecords.map((group) => (
              <AccordionItem key={group.date} value={group.date} className="rounded-md border px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex w-full flex-col gap-1 text-left sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="font-medium">{group.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {group.records.length} {group.records.length === 1 ? "check-in" : "check-ins"} recorded
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pr-3">
                      {group.activeCount > 0 && <Badge>{group.activeCount} active</Badge>}
                      <Badge variant="secondary">
                        {new Set(group.records.map((record) => record.childId)).size} children
                      </Badge>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Child</TableHead>
                        <TableHead>Classroom</TableHead>
                        <TableHead>Checked In By</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Pickup</TableHead>
                        <TableHead>Checked Out By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.records.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell>
                            <div className="font-medium">{formatDateTime(record.checkinTime)}</div>
                          </TableCell>
                          <TableCell>{record.childName}</TableCell>
                          <TableCell>{record.classroom || "Unassigned"}</TableCell>
                          <TableCell>{record.checkedInByName}</TableCell>
                          <TableCell>
                            <Badge variant={record.status === "active" ? "default" : "secondary"}>
                              {record.status === "active" ? "Checked In" : "Checked Out"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {record.status === "active" ? (
                              <span className="text-muted-foreground">Awaiting pickup</span>
                            ) : (
                              <div>
                                <div>{record.pickedUpByName || "Authorized contact"}</div>
                                <div className="text-xs text-muted-foreground">
                                  {record.checkoutTime ? formatDateTime(record.checkoutTime) : "No checkout time"}
                                </div>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {record.checkedOutByName ? (
                              <span className="text-sm">{record.checkedOutByName}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        ) : (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            No check-in history yet.
          </div>
        )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function EditChildProfileDialog({
  child,
  isUpdating,
  isAddingGuardian,
  onUpdate,
  onAddGuardian,
}: {
  child: Child;
  isUpdating: boolean;
  isAddingGuardian: boolean;
  onUpdate: (formData: FormData) => Promise<void>;
  onAddGuardian: (formData: FormData) => Promise<void>;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" onClick={(event) => event.stopPropagation()}>
          <Pencil />
          Edit Profile
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit {childName(child)}</DialogTitle>
          <DialogDescription>Update child profile details and manage pickup contacts.</DialogDescription>
        </DialogHeader>
        <EditChildProfileForm
          child={child}
          isPending={isUpdating}
          onSubmit={async (formData) => {
            await onUpdate(formData);
            setOpen(false);
          }}
        />
        <div className="border-t pt-5">
          <div className="mb-3">
            <h3 className="font-medium">Pickup Contacts</h3>
            <p className="text-sm text-muted-foreground">Add authorized pickup people from the profile edit flow.</p>
          </div>
          <AddGuardianForm
            isPending={isAddingGuardian}
            onSubmit={async (formData) => {
              await onAddGuardian(formData);
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditChildProfileForm({
  child,
  isPending,
  onSubmit,
}: {
  child: Child;
  isPending: boolean;
  onSubmit: (formData: FormData) => Promise<void>;
}) {
  const [photoValue, setPhotoValue] = React.useState(child.profilePhotoUrl ?? "");
  const [photoError, setPhotoError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setPhotoValue(child.profilePhotoUrl ?? "");
  }, [child.profilePhotoUrl, child.id]);

  const handlePhotoFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setPhotoError(null);
      setPhotoValue(await readProfilePhotoFile(file));
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : "Could not use that image.");
    } finally {
      event.target.value = "";
    }
  };

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(new FormData(event.currentTarget)).catch(() => undefined);
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field name="firstName" label="First Name" defaultValue={child.firstName} />
        <Field name="lastName" label="Last Name" defaultValue={child.lastName} />
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor={`editChildProfilePhoto-${child.id}`}>Profile Picture</Label>
          <div className="flex items-center gap-3">
            <Avatar className="h-14 w-14 border bg-primary/10">
              {photoValue && <AvatarImage src={photoValue} alt="Child profile preview" />}
              <AvatarFallback className="bg-transparent text-primary">
                {child.firstName[0]}
                {child.lastName[0]}
              </AvatarFallback>
            </Avatar>
            <Input id={`editChildProfilePhoto-${child.id}`} type="file" accept="image/*" capture="user" onChange={handlePhotoFile} />
          </div>
          <input type="hidden" name="profilePhotoUrl" value={photoValue} />
          {photoError && <p className="text-sm text-destructive">{photoError}</p>}
        </div>
        <Field name="dateOfBirth" label="Date of Birth" type="date" required={false} defaultValue={child.dateOfBirth ?? ""} />
        <Field name="gender" label="Gender" required={false} defaultValue={child.gender ?? ""} />
        <Field name="classroom" label="Classroom / Group" required={false} defaultValue={child.classroom ?? ""} />
      </div>
      <TextAreaField name="allergyInformation" label="Allergy Information" defaultValue={child.allergyInformation ?? ""} />
      <TextAreaField name="medicalNotes" label="Medical Notes" defaultValue={child.medicalNotes ?? ""} />
      <TextAreaField name="specialInstructions" label="Special Instructions" defaultValue={child.specialInstructions ?? ""} />
      <DialogFooter>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Save Profile"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function AddGuardianForm({
  isPending,
  onSubmit,
}: {
  isPending: boolean;
  onSubmit: (formData: FormData) => Promise<void>;
}) {
  return (
    <form
      className="grid gap-4 md:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        void onSubmit(new FormData(form)).then(() => form.reset()).catch(() => undefined);
      }}
    >
      <Field name="name" label="Contact Name" />
      <Field name="phoneNumber" label="Phone Number" required={false} />
      <Field name="email" label="Email" type="email" required={false} />
      <div className="space-y-2">
        <Label htmlFor="relationship">Relationship</Label>
        <select id="relationship" name="relationship" className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          <option value="parent">Parent</option>
          <option value="guardian">Guardian</option>
          <option value="emergency_contact">Emergency Contact</option>
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="authorizedPickupContact">Authorized Pickup</Label>
        <select id="authorizedPickupContact" name="authorizedPickup" className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      </div>
      <div className="flex items-end md:justify-end">
        <Button type="submit" variant="outline" disabled={isPending}>
          <Plus />
          {isPending ? "Adding..." : "Add Contact"}
        </Button>
      </div>
    </form>
  );
}

function ChildRegistrationForm({
  memberContacts,
  isPending,
  onSubmit,
}: {
  memberContacts: MemberContact[];
  isPending: boolean;
  onSubmit: (formData: FormData) => void;
}) {
  const [photoValue, setPhotoValue] = React.useState("");
  const [photoError, setPhotoError] = React.useState<string | null>(null);
  const [guardianDrafts, setGuardianDrafts] = React.useState<Array<{
    id: number;
    source: "member" | "manual";
    memberId: string;
    name: string;
    email: string;
    phoneNumber: string;
    relationship: "parent" | "guardian" | "emergency_contact";
    authorizedPickup: boolean;
  }>>([
    {
      id: 1,
      source: "member",
      memberId: "",
      name: "",
      email: "",
      phoneNumber: "",
      relationship: "parent",
      authorizedPickup: true,
    },
  ]);

  const memberById = React.useMemo(() => new Map(memberContacts.map((member) => [String(member.id), member])), [memberContacts]);

  const guardiansJson = React.useMemo(() => JSON.stringify(guardianDrafts.map((guardian) => {
    const selectedMember = guardian.source === "member" ? memberById.get(guardian.memberId) : null;
    return {
      memberId: selectedMember ? selectedMember.id : null,
      name: selectedMember?.name ?? guardian.name,
      email: selectedMember?.email ?? guardian.email,
      phoneNumber: selectedMember?.phoneNumber ?? guardian.phoneNumber,
      relationship: guardian.relationship,
      authorizedPickup: guardian.authorizedPickup,
    };
  })), [guardianDrafts, memberById]);

  function updateGuardian(id: number, updates: Partial<(typeof guardianDrafts)[number]>) {
    setGuardianDrafts((current) => current.map((guardian) => guardian.id === id ? { ...guardian, ...updates } : guardian));
  }

  function addGuardianDraft() {
    setGuardianDrafts((current) => [
      ...current,
      {
        id: Date.now(),
        source: "manual",
        memberId: "",
        name: "",
        email: "",
        phoneNumber: "",
        relationship: "guardian",
        authorizedPickup: true,
      },
    ]);
  }

  function removeGuardianDraft(id: number) {
    setGuardianDrafts((current) => current.length > 1 ? current.filter((guardian) => guardian.id !== id) : current);
  }

  const handlePhotoFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setPhotoError(null);
      setPhotoValue(await readProfilePhotoFile(file));
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : "Could not use that image.");
    } finally {
      event.target.value = "";
    }
  };

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        const validGuardian = guardianDrafts.some((guardian) => {
          if (guardian.source === "member") return Boolean(guardian.memberId);
          return Boolean(guardian.name.trim());
        });
        if (!validGuardian) return;
        onSubmit(new FormData(event.currentTarget));
        setPhotoValue("");
        setGuardianDrafts([{
          id: 1,
          source: "member",
          memberId: "",
          name: "",
          email: "",
          phoneNumber: "",
          relationship: "parent",
          authorizedPickup: true,
        }]);
        event.currentTarget.reset();
      }}
    >
      <section className="rounded-md border p-4">
        <div className="mb-4">
          <h3 className="font-medium">Child Information</h3>
          <p className="text-sm text-muted-foreground">Basic profile details used for check-in and classroom assignment.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field name="firstName" label="First Name" />
          <Field name="lastName" label="Last Name" />
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="childProfilePhoto">Profile Picture</Label>
            <div className="flex items-center gap-3">
              <Avatar className="h-14 w-14 border bg-primary/10">
                {photoValue && <AvatarImage src={photoValue} alt="Child profile preview" />}
                <AvatarFallback className="bg-transparent text-primary">CH</AvatarFallback>
              </Avatar>
              <Input id="childProfilePhoto" type="file" accept="image/*" capture="user" onChange={handlePhotoFile} />
            </div>
            <input type="hidden" name="profilePhotoUrl" value={photoValue} />
            {photoError && <p className="text-sm text-destructive">{photoError}</p>}
          </div>
          <Field name="dateOfBirth" label="Date of Birth" type="date" required={false} />
          <Field name="gender" label="Gender" required={false} />
          <Field name="classroom" label="Classroom / Group" required={false} />
        </div>
      </section>

      <section className="rounded-md border p-4">
        <div className="mb-4">
          <h3 className="font-medium">Health & Instructions</h3>
          <p className="text-sm text-muted-foreground">Information visible to authorized check-in volunteers.</p>
        </div>
        <div className="space-y-4">
          <TextAreaField name="allergyInformation" label="Allergy Information" />
          <TextAreaField name="medicalNotes" label="Medical Notes" />
          <TextAreaField name="specialInstructions" label="Special Instructions" />
        </div>
      </section>

      <section className="rounded-md border p-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="font-medium">Parent, Guardian & Pickup Contacts</h3>
            <p className="text-sm text-muted-foreground">Select registered members when possible, or add a manual contact.</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addGuardianDraft}>
            <Plus className="h-4 w-4" />
            Add Contact
          </Button>
        </div>
        <input type="hidden" name="guardiansJson" value={guardiansJson} />
        <div className="space-y-3">
          {guardianDrafts.map((guardian, index) => {
            const selectedMember = guardian.source === "member" ? memberById.get(guardian.memberId) : null;
            return (
              <div key={guardian.id} className="rounded-md border bg-muted/20 p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">Contact {index + 1}</p>
                  <Button type="button" variant="ghost" size="sm" disabled={guardianDrafts.length === 1} onClick={() => removeGuardianDraft(guardian.id)}>
                    <X className="h-4 w-4" />
                    Remove
                  </Button>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Contact Source</Label>
                    <select
                      value={guardian.source}
                      onChange={(event) => updateGuardian(guardian.id, { source: event.target.value as "member" | "manual", memberId: "", name: "", email: "", phoneNumber: "" })}
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    >
                      <option value="member">Registered Member</option>
                      <option value="manual">Manual Contact</option>
                    </select>
                  </div>

                  {guardian.source === "member" ? (
                    <div className="space-y-2">
                      <Label>Registered Member</Label>
                      <SearchableSelect
                        value={guardian.memberId}
                        onChange={(memberId) => updateGuardian(guardian.id, { memberId })}
                        placeholder="Select a member"
                        searchPlaceholder="Search members by name, email, or phone..."
                        emptyText="No matching members."
                        options={memberContacts.map((member) => ({
                          value: String(member.id),
                          label: member.name,
                          sublabel: member.phoneNumber || member.email,
                        }))}
                      />
                      {selectedMember && (
                        <p className="text-xs text-muted-foreground">
                          {selectedMember.email} · {selectedMember.phoneNumber || "No phone listed"}
                        </p>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label>Contact Name</Label>
                        <Input value={guardian.name} required onChange={(event) => updateGuardian(guardian.id, { name: event.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Phone Number</Label>
                        <Input value={guardian.phoneNumber} onChange={(event) => updateGuardian(guardian.id, { phoneNumber: event.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input type="email" value={guardian.email} onChange={(event) => updateGuardian(guardian.id, { email: event.target.value })} />
                      </div>
                    </>
                  )}

                  <div className="space-y-2">
                    <Label>Relationship</Label>
                    <select value={guardian.relationship} onChange={(event) => updateGuardian(guardian.id, { relationship: event.target.value as "parent" | "guardian" | "emergency_contact" })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                      <option value="parent">Parent</option>
                      <option value="guardian">Guardian</option>
                      <option value="emergency_contact">Emergency Contact</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Authorized Pickup</Label>
                    <select value={guardian.authorizedPickup ? "true" : "false"} onChange={(event) => updateGuardian(guardian.id, { authorizedPickup: event.target.value === "true" })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <DialogFooter>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Register Child"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function CheckinConfirmDialog({
  child,
  isPending,
  onConfirm,
}: {
  child: Child;
  isPending: boolean;
  onConfirm: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const authorized = child.guardians.filter((g) => g.authorizedPickup);
  const hasAlerts = !!(child.allergyInformation || child.medicalNotes);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" onClick={(event) => event.stopPropagation()}>
          Check In
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Check-In</DialogTitle>
          <DialogDescription>Review this child's profile before checking them in.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <ChildAvatar child={child} size="lg" />
            <div>
              <p className="text-lg font-semibold">{childName(child)}</p>
              <p className="text-sm text-muted-foreground">
                {child.age !== null ? `${child.age} years old` : "Age not listed"} · {child.classroom || "No classroom assigned"}
              </p>
            </div>
          </div>
          {hasAlerts && (
            <div className="rounded-md border border-amber-200 bg-white p-3 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Health Alerts</p>
              {child.allergyInformation && (
                <p className="text-sm text-slate-900"><span className="font-medium">Allergies:</span> {child.allergyInformation}</p>
              )}
              {child.medicalNotes && (
                <p className="text-sm text-slate-900"><span className="font-medium">Medical:</span> {child.medicalNotes}</p>
              )}
            </div>
          )}
          {authorized.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium">Authorized Pickup Contacts</p>
              <div className="space-y-1">
                {authorized.map((guardian) => (
                  <div key={guardian.id} className="flex items-center justify-between text-sm">
                    <span>{guardian.name} · <span className="text-muted-foreground">{relationshipLabel(guardian.relationship)}</span></span>
                    {guardian.phoneNumber && <span className="text-muted-foreground">{guardian.phoneNumber}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {authorized.length === 0 && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              No authorized pickup contacts on file. Add a guardian before check-in.
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            disabled={isPending}
            onClick={() => {
              onConfirm();
              setOpen(false);
            }}
          >
            {isPending ? "Checking in..." : "Confirm Check-In"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CheckoutDialog({
  child,
  isPending,
  onCheckout,
}: {
  child: Child;
  isPending: boolean;
  onCheckout: (guardianId: number, pickupCode: string) => void;
}) {
  const authorizedGuardians = child.guardians.filter((guardian) => guardian.authorizedPickup);
  const [guardianId, setGuardianId] = React.useState<string>("");
  const [pickupCode, setPickupCode] = React.useState("");

  React.useEffect(() => {
    setGuardianId(authorizedGuardians[0]?.id ? String(authorizedGuardians[0].id) : "");
    setPickupCode("");
  }, [child.id, authorizedGuardians[0]?.id]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" onClick={(event) => event.stopPropagation()}>
          <LogOut />
          Check Out
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Check Out {childName(child)}</DialogTitle>
          <DialogDescription>Select the authorized pickup contact and enter their security code.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`pickup-${child.id}`}>Picked Up By</Label>
            <select
              id={`pickup-${child.id}`}
              value={guardianId}
              onChange={(event) => setGuardianId(event.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              disabled={authorizedGuardians.length === 0}
            >
              {authorizedGuardians.map((guardian) => (
                <option key={guardian.id} value={guardian.id}>
                  {guardian.name} · {relationshipLabel(guardian.relationship)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`code-${child.id}`}>Pickup Security Code</Label>
            <Input
              id={`code-${child.id}`}
              value={pickupCode}
              onChange={(event) => setPickupCode(event.target.value.toUpperCase())}
              placeholder="e.g. A1B2C3"
              className="font-mono tracking-widest uppercase"
              maxLength={6}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">The 6-character code given to the family at check-in.</p>
          </div>
          {authorizedGuardians.length === 0 && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              Add an authorized pickup contact before checking this child out.
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            disabled={!guardianId || !pickupCode.trim() || isPending}
            onClick={() => onCheckout(Number(guardianId), pickupCode.trim())}
          >
            Confirm Check-Out
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MetricCard({ icon: Icon, label, value, tooltip }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; tooltip: string }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-sm text-muted-foreground">{label}</p>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" title={tooltip} className="rounded-full text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring" aria-label={`${label} details`}>
                  <CircleHelp className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-64">
                {tooltip}
              </TooltipContent>
            </Tooltip>
          </div>
          <p className="text-2xl font-semibold">{value}</p>
        </div>
        <Icon className="h-5 w-5 text-primary" />
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1">{value}</p>
    </div>
  );
}

function Field({
  name,
  label,
  type = "text",
  required = true,
  defaultValue,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} required={required} defaultValue={defaultValue} />
    </div>
  );
}

function TextAreaField({ name, label, defaultValue }: { name: string; label: string; defaultValue?: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Textarea id={name} name={name} defaultValue={defaultValue} />
    </div>
  );
}

function formPayload(formData: FormData) {
  const payload = Object.fromEntries(Array.from(formData.entries()).map(([key, value]) => {
    if (value === "true") return [key, true];
    if (value === "false") return [key, false];
    return [key, value];
  }));
  if (typeof payload.guardiansJson === "string") {
    try {
      payload.guardians = JSON.parse(payload.guardiansJson);
    } catch {
      payload.guardians = [];
    }
    delete payload.guardiansJson;
  }
  return payload;
}

function ChildAvatar({ child, size = "sm" }: { child: Child; size?: "sm" | "lg" }) {
  return (
    <Avatar className={`${size === "lg" ? "h-14 w-14" : "h-10 w-10"} shrink-0 border bg-primary/10`}>
      {child.profilePhotoUrl && <AvatarImage src={child.profilePhotoUrl} alt={childName(child)} />}
      <AvatarFallback className="bg-transparent text-primary">
        {child.firstName[0]}
        {child.lastName[0]}
      </AvatarFallback>
    </Avatar>
  );
}
