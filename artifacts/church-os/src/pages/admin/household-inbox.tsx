import React from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Inbox, Mail, Phone, UserRound } from "lucide-react";

type HouseholdRequestStatus = "submitted" | "reviewing" | "completed" | "declined";

type HouseholdRequest = {
  id: number;
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
  };
};

async function apiJson<T>(path: string, options?: RequestInit): Promise<T> {
  const demoToken = sessionStorage.getItem("demo_token");
  const response = await fetch(`/api${path}`, {
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(demoToken ? { authorization: `Bearer ${demoToken}` } : {}),
      ...(options?.headers ?? {}),
    },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "Request failed");
  return data as T;
}

function labelize(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
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

export default function AdminHouseholdInbox() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = React.useState("");

  const requestsQuery = useQuery({
    queryKey: ["admin-household-requests", status],
    queryFn: () => {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      const query = params.toString();
      return apiJson<{ requests: HouseholdRequest[] }>(`/admin/household-requests${query ? `?${query}` : ""}`);
    },
  });

  const updateStatus = useMutation({
    mutationFn: ({ requestId, nextStatus }: { requestId: number; nextStatus: HouseholdRequestStatus }) => apiJson<{ request: { id: number; status: HouseholdRequestStatus } }>(`/admin/household-requests/${requestId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: nextStatus }),
    }),
    onSuccess: () => {
      toast({ title: "Request updated" });
      void queryClient.invalidateQueries({ queryKey: ["admin-household-requests"] });
    },
    onError: (error) => toast({ title: "Could not update request", description: error.message, variant: "destructive" }),
  });

  const requests = requestsQuery.data?.requests ?? [];
  const submittedCount = requests.filter((request) => request.status === "submitted").length;
  const reviewingCount = requests.filter((request) => request.status === "reviewing").length;

  return (
    <AdminLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-lg border border-blue-100 bg-blue-50/45 p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-blue-200 bg-white text-primary">
                <Inbox className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Super Admin</p>
                <h1 className="text-3xl font-semibold tracking-tight">Household Inbox</h1>
                <p className="text-sm text-muted-foreground">Review member requests for household, contact, child links, and pickup changes.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:w-72">
              <div className="rounded-lg border bg-white p-3">
                <p className="text-xs text-muted-foreground">New</p>
                <p className="text-2xl font-semibold">{submittedCount}</p>
              </div>
              <div className="rounded-lg border bg-white p-3">
                <p className="text-xs text-muted-foreground">Reviewing</p>
                <p className="text-2xl font-semibold">{reviewingCount}</p>
              </div>
            </div>
          </div>
        </section>

        <Card>
          <CardHeader className="gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle>Requests</CardTitle>
              <CardDescription>Changing the inbox status does not edit member records. Use the linked member profile to make official updates.</CardDescription>
            </div>
            <div className="space-y-2 md:w-56">
              <Label>Status</Label>
              <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">All requests</option>
                <option value="submitted">Submitted</option>
                <option value="reviewing">Reviewing</option>
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
                    <TableHead>Member</TableHead>
                    <TableHead>Request</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Update Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request) => (
                    <TableRow key={request.id} className="align-top">
                      <TableCell className="min-w-56">
                        <div className="space-y-2">
                          <Link href={`/admin/members/${request.member.id}`} className="flex items-center gap-2 font-medium text-primary hover:underline">
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
                          <Badge variant="outline">{labelize(request.requestType)}</Badge>
                          <p className="whitespace-pre-wrap text-sm text-foreground">{request.message}</p>
                          {request.reviewedAt && <p className="text-xs text-muted-foreground">Last reviewed {formatDateTime(request.reviewedAt)}</p>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusClass(request.status)}>{labelize(request.status)}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDateTime(request.createdAt)}</TableCell>
                      <TableCell>
                        <select
                          value={request.status}
                          disabled={updateStatus.isPending}
                          onChange={(event) => updateStatus.mutate({ requestId: request.id, nextStatus: event.target.value as HouseholdRequestStatus })}
                          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                        >
                          <option value="submitted">Submitted</option>
                          <option value="reviewing">Reviewing</option>
                          <option value="completed">Completed</option>
                          <option value="declined">Declined</option>
                        </select>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!requests.length && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                        {requestsQuery.isLoading ? "Loading household requests..." : "No household requests found."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
