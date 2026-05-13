import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/AdminLayout";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useToast } from "@/hooks/use-toast";
import { readProfilePhotoFile } from "@/lib/profile-photo";
import { CalendarCheck, History, LogOut, Pencil, Plus, ShieldCheck, UserRound } from "lucide-react";

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
  pickedUpByName: string | null;
};

async function apiJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    credentials: "include",
    headers: { "content-type": "application/json", ...(options?.headers ?? {}) },
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

  const childrenQuery = useQuery({
    queryKey: ["children-checkin"],
    queryFn: () => apiJson<{ children: Child[] }>("/admin/checkin/children"),
  });

  const historyQuery = useQuery({
    queryKey: ["children-checkin-history"],
    queryFn: () => apiJson<{ history: MinistryCheckinHistoryRecord[] }>("/admin/checkin/history"),
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
    mutationFn: (child: Child) => apiJson<{ child: Child }>(`/admin/checkin/children/${child.id}/check-in`, {
      method: "POST",
      body: JSON.stringify({ classroom: child.classroom }),
    }),
    onSuccess: (data) => {
      setSelectedChildId(data.child.id);
      toast({ title: "Child checked in" });
      void refresh();
    },
    onError: (error) => toast({ title: "Check-in failed", description: error.message, variant: "destructive" }),
  });

  const checkOut = useMutation({
    mutationFn: ({ childId, guardianId }: { childId: number; guardianId: number }) =>
      apiJson<{ child: Child }>(`/admin/checkin/children/${childId}/check-out`, {
        method: "POST",
        body: JSON.stringify({ guardianId }),
      }),
    onSuccess: (data) => {
      setSelectedChildId(data.child.id);
      toast({ title: "Child checked out" });
      void refresh();
    },
    onError: (error) => toast({ title: "Check-out failed", description: error.message, variant: "destructive" }),
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
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Children Ministry</h1>
            <p className="text-muted-foreground">Register children, manage pickup contacts, and track active check-ins.</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard icon={UserRound} label="Children" value={String(children.length)} />
          <MetricCard icon={CalendarCheck} label="Active Check-ins" value={String(activeChildren.length)} />
          <MetricCard icon={ShieldCheck} label="Authorized Contacts" value={String(children.reduce((sum, child) => sum + child.guardians.filter((guardian) => guardian.authorizedPickup).length, 0))} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Active Check-ins</CardTitle>
            <CardDescription>Children currently checked in and awaiting authorized pickup.</CardDescription>
          </CardHeader>
          <CardContent>
            {activeChildren.length > 0 ? (
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
                        </div>
                      </div>
                      <CheckoutDialog child={child} isPending={checkOut.isPending} onCheckout={(guardianId) => checkOut.mutate({ childId: child.id, guardianId })} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                No active check-ins yet.
              </div>
            )}
          </CardContent>
        </Card>

        <MinistryCheckinHistory records={checkinHistory} isLoading={historyQuery.isLoading} />

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
                                <CheckoutDialog child={child} isPending={checkOut.isPending} onCheckout={(guardianId) => checkOut.mutate({ childId: child.id, guardianId })} />
                              ) : (
                                <Button size="sm" onClick={(event) => {
                                  event.stopPropagation();
                                  checkIn.mutate(child);
                                }}>
                                  Check In
                                </Button>
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
                                onUpdate={(formData) => updateChild.mutateAsync({ childId: child.id, formData }).then(() => undefined)}
                                onAddGuardian={(formData) => addGuardian.mutateAsync({ childId: child.id, formData }).then(() => undefined)}
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
                  No children match that search.
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
  onUpdate,
  onAddGuardian,
}: {
  child: Child;
  isUpdating: boolean;
  isAddingGuardian: boolean;
  onUpdate: (formData: FormData) => Promise<void>;
  onAddGuardian: (formData: FormData) => Promise<void>;
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

function MinistryCheckinHistory({
  records,
  isLoading,
}: {
  records: MinistryCheckinHistoryRecord[];
  isLoading: boolean;
}) {
  const groupedRecords = React.useMemo(() => {
    const groups = new Map<string, MinistryCheckinHistoryRecord[]>();

    records.forEach((record) => {
      const key = dateGroupKey(record.checkinTime);
      groups.set(key, [...(groups.get(key) ?? []), record]);
    });

    return Array.from(groups.entries()).map(([date, dateRecords]) => ({
      date,
      label: formatDate(dateRecords[0]?.checkinTime ?? date),
      records: dateRecords,
      activeCount: dateRecords.filter((record) => record.status === "active").length,
    }));
  }, [records]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          <CardTitle>Check-In History</CardTitle>
        </div>
        <CardDescription>Attendance log for Children Ministry by date, time, child, and check-in person.</CardDescription>
      </CardHeader>
      <CardContent>
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
    </Card>
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
            <Input id={`editChildProfilePhoto-${child.id}`} type="file" accept="image/*" onChange={handlePhotoFile} />
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
  isPending,
  onSubmit,
}: {
  isPending: boolean;
  onSubmit: (formData: FormData) => void;
}) {
  const [photoValue, setPhotoValue] = React.useState("");
  const [photoError, setPhotoError] = React.useState<string | null>(null);

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
        onSubmit(new FormData(event.currentTarget));
        setPhotoValue("");
        event.currentTarget.reset();
      }}
    >
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
            <Input id="childProfilePhoto" type="file" accept="image/*" onChange={handlePhotoFile} />
          </div>
          <input type="hidden" name="profilePhotoUrl" value={photoValue} />
          {photoError && <p className="text-sm text-destructive">{photoError}</p>}
        </div>
        <Field name="dateOfBirth" label="Date of Birth" type="date" required={false} />
        <Field name="gender" label="Gender" required={false} />
        <Field name="classroom" label="Classroom / Group" required={false} />
        <Field name="guardianName" label="Parent / Guardian Name" />
        <Field name="guardianPhoneNumber" label="Guardian Phone" required={false} />
        <Field name="guardianEmail" label="Guardian Email" type="email" required={false} />
        <div className="space-y-2">
          <Label htmlFor="guardianRelationship">Relationship</Label>
          <select id="guardianRelationship" name="guardianRelationship" className="h-10 w-full rounded-md border bg-background px-3 text-sm">
            <option value="parent">Parent</option>
            <option value="guardian">Guardian</option>
            <option value="emergency_contact">Emergency Contact</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="authorizedPickup">Authorized Pickup</Label>
          <select id="authorizedPickup" name="authorizedPickup" className="h-10 w-full rounded-md border bg-background px-3 text-sm">
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>
      </div>
      <TextAreaField name="allergyInformation" label="Allergy Information" />
      <TextAreaField name="medicalNotes" label="Medical Notes" />
      <TextAreaField name="specialInstructions" label="Special Instructions" />
      <DialogFooter>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Register Child"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function CheckoutDialog({
  child,
  isPending,
  onCheckout,
}: {
  child: Child;
  isPending: boolean;
  onCheckout: (guardianId: number) => void;
}) {
  const authorizedGuardians = child.guardians.filter((guardian) => guardian.authorizedPickup);
  const [guardianId, setGuardianId] = React.useState<string>("");

  React.useEffect(() => {
    setGuardianId(authorizedGuardians[0]?.id ? String(authorizedGuardians[0].id) : "");
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
          <DialogDescription>Only authorized pickup contacts can be selected.</DialogDescription>
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
          {authorizedGuardians.length === 0 && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              Add an authorized pickup contact before checking this child out.
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            disabled={!guardianId || isPending}
            onClick={() => onCheckout(Number(guardianId))}
          >
            Confirm Check-Out
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
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
  return Object.fromEntries(Array.from(formData.entries()).map(([key, value]) => {
    if (value === "true") return [key, true];
    if (value === "false") return [key, false];
    return [key, value];
  }));
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
