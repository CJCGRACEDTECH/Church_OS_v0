import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/AdminLayout";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  apiJson,
  dollars,
  formatDate,
  labelize,
  type CampaignStatus,
  type Donation,
  type GivingCampaign,
  type GivingCategory,
  type GivingSummary,
  type PaymentStatus,
} from "@/lib/giving";
import { BadgeDollarSign, ChevronDown, Download, Megaphone, Pencil, Plus, Search, ShieldCheck, Trash2, Users } from "lucide-react";

type CampaignForm = {
  campaignName: string;
  description: string;
  goalAmount: string;
  status: CampaignStatus;
  campaignCategory: string;
  campaignImageUrl: string;
  startDate: string;
  endDate: string;
};

type CampaignErrors = {
  campaignName?: string;
  goalAmount?: string;
  endDate?: string;
};

const emptyCampaignForm: CampaignForm = {
  campaignName: "",
  description: "",
  goalAmount: "10000",
  status: "active",
  campaignCategory: "Gift/Offering",
  campaignImageUrl: "",
  startDate: new Date().toISOString().slice(0, 10),
  endDate: "",
};

function campaignToForm(campaign: GivingCampaign): CampaignForm {
  return {
    campaignName: campaign.campaignName,
    description: campaign.description ?? "",
    goalAmount: String(campaign.goalAmountCents / 100),
    status: campaign.status,
    campaignCategory: campaign.campaignCategory ?? "",
    campaignImageUrl: campaign.campaignImageUrl ?? "",
    startDate: campaign.startDate ? campaign.startDate.slice(0, 10) : "",
    endDate: campaign.endDate ? campaign.endDate.slice(0, 10) : "",
  };
}

function validateCampaignForm(form: CampaignForm): CampaignErrors {
  const errors: CampaignErrors = {};
  if (!form.campaignName.trim()) errors.campaignName = "Campaign name is required.";
  if (Number(form.goalAmount) <= 0) errors.goalAmount = "Goal amount must be greater than $0.";
  if (form.endDate && new Date(form.endDate) < new Date(new Date().toDateString())) {
    errors.endDate = "End date must be today or in the future.";
  }
  return errors;
}

const thisYear = new Date().getFullYear();

export default function AdminGiving() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [fromDate, setFromDate] = React.useState(`${thisYear}-01-01`);
  const [toDate, setToDate] = React.useState(`${thisYear}-12-31`);
  const [category, setCategory] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [campaignOpen, setCampaignOpen] = React.useState(false);
  const [campaignForm, setCampaignForm] = React.useState<CampaignForm>(emptyCampaignForm);
  const [campaignErrors, setCampaignErrors] = React.useState<CampaignErrors>({});
  const [editingCampaign, setEditingCampaign] = React.useState<GivingCampaign | null>(null);
  const [campaignsExpanded, setCampaignsExpanded] = React.useState(true);
  const [recordsExpanded, setRecordsExpanded] = React.useState(true);

  async function exportCsv() {
    try {
      const demoToken = sessionStorage.getItem("demo_token");
      const response = await fetch("/api/admin/giving/export.csv", {
        credentials: "include",
        headers: demoToken ? { authorization: `Bearer ${demoToken}` } : {},
      });
      if (!response.ok) throw new Error("Export failed.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "giving-records.csv";
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({ title: "Export unavailable", description: error instanceof Error ? error.message : "Try again later.", variant: "destructive" });
    }
  }

  const summaryQuery = useQuery({
    queryKey: ["admin-giving-summary"],
    queryFn: () => apiJson<GivingSummary>("/admin/giving/summary"),
  });

  const donationsQuery = useQuery({
    queryKey: ["admin-giving-donations", search, fromDate, toDate, category, status],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (fromDate) params.set("fromDate", fromDate);
      if (toDate) params.set("toDate", toDate);
      if (category) params.set("category", category);
      if (status) params.set("status", status);
      return apiJson<{ donations: Donation[] }>(`/admin/giving/donations?${params}`);
    },
  });

  const campaignsQuery = useQuery({
    queryKey: ["admin-giving-campaigns"],
    queryFn: () => apiJson<{ campaigns: GivingCampaign[] }>("/admin/giving/campaigns"),
  });

  function submitCampaign() {
    const errors = validateCampaignForm(campaignForm);
    setCampaignErrors(errors);
    if (Object.keys(errors).length > 0) return;
    if (editingCampaign) {
      updateCampaign.mutate();
    } else {
      createCampaign.mutate();
    }
  }

  const createCampaign = useMutation({
    mutationFn: () => apiJson<{ campaign: GivingCampaign }>("/admin/giving/campaigns", {
      method: "POST",
      body: JSON.stringify({
        ...campaignForm,
        goalAmount: Number(campaignForm.goalAmount),
        startDate: campaignForm.startDate || null,
        endDate: campaignForm.endDate || null,
      }),
    }),
    onSuccess: () => {
      setCampaignOpen(false);
      setCampaignForm(emptyCampaignForm);
      setCampaignErrors({});
      toast({ title: "Campaign created" });
      void queryClient.invalidateQueries({ queryKey: ["admin-giving-campaigns"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-giving-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
    onError: (error) => toast({ title: "Could not create campaign", description: error.message, variant: "destructive" }),
  });

  const updateCampaign = useMutation({
    mutationFn: () => {
      if (!editingCampaign) throw new Error("Choose a campaign to edit.");
      return apiJson<{ campaign: GivingCampaign }>(`/admin/giving/campaigns/${editingCampaign.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...campaignForm,
          goalAmount: Number(campaignForm.goalAmount),
          startDate: campaignForm.startDate || null,
          endDate: campaignForm.endDate || null,
        }),
      });
    },
    onSuccess: () => {
      setCampaignOpen(false);
      setEditingCampaign(null);
      setCampaignForm(emptyCampaignForm);
      setCampaignErrors({});
      toast({ title: "Campaign updated" });
      void queryClient.invalidateQueries({ queryKey: ["admin-giving-campaigns"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-giving-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
    onError: (error) => toast({ title: "Could not update campaign", description: error.message, variant: "destructive" }),
  });

  const deactivateCampaign = useMutation({
    mutationFn: () => {
      if (!editingCampaign) throw new Error("Choose a campaign to deactivate.");
      return apiJson<{ campaign: GivingCampaign }>(`/admin/giving/campaigns/${editingCampaign.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "cancelled" }),
      });
    },
    onSuccess: () => {
      setCampaignOpen(false);
      setEditingCampaign(null);
      setCampaignForm(emptyCampaignForm);
      toast({ title: "Campaign deactivated" });
      void queryClient.invalidateQueries({ queryKey: ["admin-giving-campaigns"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-giving-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
    onError: (error) => toast({ title: "Could not deactivate campaign", description: error.message, variant: "destructive" }),
  });

  const deleteCampaign = useMutation({
    mutationFn: () => {
      if (!editingCampaign) throw new Error("Choose a campaign to delete.");
      return apiJson<{ ok: true }>(`/admin/giving/campaigns/${editingCampaign.id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      setCampaignOpen(false);
      setEditingCampaign(null);
      setCampaignForm(emptyCampaignForm);
      toast({ title: "Campaign deleted" });
      void queryClient.invalidateQueries({ queryKey: ["admin-giving-campaigns"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-giving-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
    onError: (error) => toast({ title: "Could not delete campaign", description: error.message, variant: "destructive" }),
  });

  function openNewCampaign() {
    setEditingCampaign(null);
    setCampaignForm(emptyCampaignForm);
    setCampaignErrors({});
    setCampaignOpen(true);
  }

  function openEditCampaign(campaign: GivingCampaign) {
    setEditingCampaign(campaign);
    setCampaignForm(campaignToForm(campaign));
    setCampaignErrors({});
    setCampaignOpen(true);
  }

  const summary = summaryQuery.data;
  const donations = donationsQuery.data?.donations ?? [];
  const campaigns = campaignsQuery.data?.campaigns ?? [];
  const isLoadingSummary = summaryQuery.isLoading;
  const isLoadingDonations = donationsQuery.isLoading;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Finance"
          title="Giving"
          description="Review donations, manage campaigns, and export giving records."
          icon={<BadgeDollarSign className="h-6 w-6" />}
          actions={
            <>
              <Button variant="outline" onClick={exportCsv}>
                <Download className="mr-2 h-4 w-4" /> Export CSV
              </Button>
              <Dialog open={campaignOpen} onOpenChange={setCampaignOpen}>
                <DialogTrigger asChild><Button onClick={openNewCampaign}><Plus className="mr-2 h-4 w-4" /> New Campaign</Button></DialogTrigger>
                <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingCampaign ? "Manage Giving Campaign" : "Create Giving Campaign"}</DialogTitle>
                  <DialogDescription>{editingCampaign ? "Update campaign details, goal, image, dates, or status." : "Campaign management is protected by backend permissions."}</DialogDescription>
                </DialogHeader>
                <CampaignFormView
                  form={campaignForm}
                  errors={campaignErrors}
                  setForm={(f) => { setCampaignForm(f); setCampaignErrors({}); }}
                  onSubmit={submitCampaign}
                  isSubmitting={createCampaign.isPending || updateCampaign.isPending || deactivateCampaign.isPending || deleteCampaign.isPending}
                  submitLabel={editingCampaign ? "Save Changes" : "Create Campaign"}
                  editingCampaign={editingCampaign}
                  onDeactivate={() => deactivateCampaign.mutate()}
                  onDelete={() => deleteCampaign.mutate()}
                />
              </DialogContent>
            </Dialog>
            </>
          }
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {isLoadingSummary ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}><CardContent className="p-6"><Skeleton className="h-4 w-28 mb-3" /><Skeleton className="h-8 w-20" /></CardContent></Card>
            ))
          ) : (
            <>
              <StatCard label="Giving This Year" value={dollars(summary?.totalYearCents ?? 0)} trend="YTD succeeded donations" />
              <StatCard label="Giving This Month" value={dollars(summary?.totalMonthCents ?? 0)} trend="Current month" />
              <StatCard label="Avg Gift (YTD)" value={dollars(summary?.avgGiftCents ?? 0)} trend="Average gift size this year" />
              <StatCard label="Unique Donors" value={String(summary?.donorsCount ?? 0)} trend="Members who have given" />
              <StatCard label="Recurring Giving" value={dollars(summary?.recurringCents ?? 0)} trend="Succeeded recurring gifts" />
              <StatCard label="Active Campaigns" value={String(summary?.activeCampaigns ?? 0)} trend={`${summary?.failedPayments ?? 0} failed payment${(summary?.failedPayments ?? 0) !== 1 ? "s" : ""}`} />
            </>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Security Boundary</CardTitle>
            <CardDescription>Giving records are only available to admins with giving permissions. Ministers do not receive this access by default.</CardDescription>
          </CardHeader>
        </Card>

        <Collapsible open={campaignsExpanded} onOpenChange={setCampaignsExpanded}>
          <Card>
            <CardHeader>
              <CollapsibleTrigger asChild>
                <button type="button" className="flex w-full items-start justify-between gap-4 text-left">
                  <div>
                    <CardTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5" /> Campaigns</CardTitle>
                    <CardDescription>Active campaigns appear on the member Give page.</CardDescription>
                  </div>
                  <ChevronDown className={`mt-1 h-4 w-4 text-muted-foreground transition-transform ${campaignsExpanded ? "rotate-180" : ""}`} />
                </button>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent>
                {campaignsQuery.isLoading ? (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <div key={i} className="rounded-md border p-4 space-y-3">
                        <Skeleton className="h-32 w-full rounded-md" />
                        <Skeleton className="h-5 w-40" />
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-2 w-full rounded-full" />
                      </div>
                    ))}
                  </div>
                ) : campaigns.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {campaigns.map((campaign) => (
                      <div key={campaign.id} className="rounded-md border p-4">
                        {campaign.campaignImageUrl && <img src={campaign.campaignImageUrl} alt="" className="mb-4 h-32 w-full rounded-md object-cover" />}
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-semibold">{campaign.campaignName}</h3>
                            <p className="text-sm text-muted-foreground">{campaign.campaignCategory ?? "Campaign"}</p>
                          </div>
                          <Badge variant={campaign.status === "active" ? "default" : "secondary"}>{labelize(campaign.status)}</Badge>
                        </div>
                        <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{campaign.description}</p>
                        <Progress className="mt-4" value={campaign.progressPercent} />
                        <div className="mt-2 flex items-center justify-between text-sm text-muted-foreground">
                          <span>{dollars(campaign.amountRaisedCents)} raised</span>
                          <span>of {dollars(campaign.goalAmountCents)}</span>
                        </div>
                        {campaign.endDate && <p className="mt-1 text-xs text-muted-foreground">Ends {formatDate(campaign.endDate)}</p>}
                        <Button className="mt-4 w-full" variant="secondary" onClick={() => openEditCampaign(campaign)}>
                          <Pencil className="mr-2 h-4 w-4" /> Manage Campaign
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed p-8 text-center">
                    <Megaphone className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
                    <p className="font-medium text-muted-foreground">No campaigns yet</p>
                    <p className="mt-1 text-sm text-muted-foreground">Create your first campaign to start collecting toward a goal.</p>
                    <Button className="mt-4" onClick={openNewCampaign}><Plus className="mr-2 h-4 w-4" /> New Campaign</Button>
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        <Collapsible open={recordsExpanded} onOpenChange={setRecordsExpanded}>
          <Card>
            <CardHeader>
              <CollapsibleTrigger asChild>
                <button type="button" className="flex w-full items-start justify-between gap-4 text-left">
                  <div>
                    <CardTitle>Giving Records</CardTitle>
                    <CardDescription>Search donations, filter by date range, and review payment details.</CardDescription>
                  </div>
                  <ChevronDown className={`mt-1 h-4 w-4 text-muted-foreground transition-transform ${recordsExpanded ? "rotate-180" : ""}`} />
                </button>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[1fr_160px_160px_180px_160px]">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search donor name or email" value={search} onChange={(event) => setSearch(event.target.value)} />
              </div>
              <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} title="From date" />
              <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} title="To date" />
              <select value={category} onChange={(event) => setCategory(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="">All categories</option>
                <option value="tithe">Tithe</option>
                <option value="offering">Gift/Offering</option>
                <option value="building_fund">Building Fund</option>
              </select>
              <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="">All statuses</option>
                <option value="pending">Pending</option>
                <option value="succeeded">Succeeded</option>
                <option value="failed">Failed</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Donor</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingDonations ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-6" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                      </TableRow>
                    ))
                  ) : donations.length > 0 ? (
                    donations.map((donation) => (
                      <TableRow key={donation.id}>
                        <TableCell>
                          <div className="font-medium">{donation.donorName}</div>
                          <div className="text-xs text-muted-foreground">{donation.donorEmail}</div>
                        </TableCell>
                        <TableCell>{formatDate(donation.donationDate)}</TableCell>
                        <TableCell>{labelize(donation.givingCategory)}</TableCell>
                        <TableCell><Badge variant={statusVariant(donation.paymentStatus)}>{labelize(donation.paymentStatus)}</Badge></TableCell>
                        <TableCell>{labelize(donation.donationType)}</TableCell>
                        <TableCell className="text-right font-medium">{dollars(donation.amountCents)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="py-12 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <Users className="h-8 w-8 text-muted-foreground/40" />
                          <p className="font-medium text-muted-foreground">No donations recorded yet</p>
                          <p className="text-sm text-muted-foreground">Set up Stripe to accept online giving, or adjust your date filters.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>
    </AdminLayout>
  );
}

function CampaignFormView({
  form,
  errors,
  setForm,
  onSubmit,
  isSubmitting,
  submitLabel,
  editingCampaign,
  onDeactivate,
  onDelete,
}: {
  form: CampaignForm;
  errors: CampaignErrors;
  setForm: (form: CampaignForm) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  submitLabel: string;
  editingCampaign: GivingCampaign | null;
  onDeactivate: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Campaign Name</Label>
          <Input value={form.campaignName} onChange={(event) => setForm({ ...form, campaignName: event.target.value })} />
          {errors.campaignName && <p className="text-sm text-destructive">{errors.campaignName}</p>}
        </div>
        <div className="space-y-2">
          <Label>Goal Amount ($)</Label>
          <Input type="number" min="1" value={form.goalAmount} onChange={(event) => setForm({ ...form, goalAmount: event.target.value })} />
          {errors.goalAmount && <p className="text-sm text-destructive">{errors.goalAmount}</p>}
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as CampaignStatus })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label>Category</Label>
          <Input value={form.campaignCategory} onChange={(event) => setForm({ ...form, campaignCategory: event.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Start Date</Label>
          <Input type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>End Date</Label>
          <Input type="date" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} />
          {errors.endDate && <p className="text-sm text-destructive">{errors.endDate}</p>}
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Campaign Image URL</Label>
          <Input value={form.campaignImageUrl} onChange={(event) => setForm({ ...form, campaignImageUrl: event.target.value })} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Description</Label>
          <Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={4} />
        </div>
      </div>
      <div className="flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {editingCampaign && editingCampaign.status !== "cancelled" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="outline" disabled={isSubmitting}>Deactivate</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Deactivate this campaign?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This sets the campaign status to cancelled and hides it from active giving flows, while keeping donation history intact.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onDeactivate}>Deactivate Campaign</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {editingCampaign && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive" disabled={isSubmitting}>
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this campaign?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Deleting is only allowed when the campaign has no donation history. If gifts are linked to it, Church OS will block deletion and you should deactivate it instead.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={onDelete}>
                    Delete Campaign
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
        <Button onClick={onSubmit} disabled={isSubmitting}>{isSubmitting ? "Saving..." : submitLabel}</Button>
      </div>
    </div>
  );
}

function statusVariant(status: PaymentStatus) {
  return status === "succeeded" ? "default" : status === "failed" || status === "refunded" ? "destructive" : "secondary";
}
