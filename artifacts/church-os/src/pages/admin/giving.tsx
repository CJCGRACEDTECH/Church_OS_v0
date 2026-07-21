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
  type UnmatchedDonation,
} from "@/lib/giving";
import { BadgeDollarSign, ChevronDown, Download, HandCoins, Inbox, Link2, Megaphone, Pencil, Plus, Search, ShieldCheck, Trash2, Trophy, Users, UserX } from "lucide-react";

type ReportSummary = {
  totalCents: number;
  count: number;
  donorsCount: number;
  byCategory: { key: string; totalCents: number; count: number }[];
  byMethod: { key: string; totalCents: number; count: number }[];
};

type TopDonorsReport = {
  donors: { memberId: number; name: string; email: string | null; totalCents: number; giftCount: number; lastGiftDate: string }[];
  unattributed: { totalCents: number; count: number };
};

type MemberOption = { id: number; firstName: string; lastName: string; email: string };

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
  campaignCategory: "Giftings",
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
  const [method, setMethod] = React.useState("");
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
    queryKey: ["admin-giving-donations", search, fromDate, toDate, category, status, method],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (fromDate) params.set("fromDate", fromDate);
      if (toDate) params.set("toDate", toDate);
      if (category) params.set("category", category);
      if (status) params.set("status", status);
      if (method) params.set("method", method);
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
              <RecordDonationDialog campaigns={campaigns} onRecorded={() => {
                void queryClient.invalidateQueries({ queryKey: ["admin-giving-donations"] });
                void queryClient.invalidateQueries({ queryKey: ["admin-giving-summary"] });
                void queryClient.invalidateQueries({ queryKey: ["admin-giving-reports"] });
              }} />
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

        <GivingReportsCard />

        <UnmatchedQueueCard />

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
            <div className="grid gap-3 md:grid-cols-[1fr_150px_150px_170px_140px_150px]">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search donor name or email" value={search} onChange={(event) => setSearch(event.target.value)} />
              </div>
              <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} title="From date" />
              <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} title="To date" />
              <select value={category} onChange={(event) => setCategory(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="">All categories</option>
                <option value="love_offering">Love Offering</option>
                <option value="tithe">Tithe</option>
                <option value="kingdom_commitment">Kingdom Commitment</option>
                <option value="giftings">Giftings</option>
              </select>
              <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="">All statuses</option>
                <option value="pending">Pending</option>
                <option value="succeeded">Succeeded</option>
                <option value="failed">Failed</option>
                <option value="refunded">Refunded</option>
                <option value="disputed">Disputed</option>
              </select>
              <select value={method} onChange={(event) => setMethod(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="">All methods</option>
                <option value="stripe">Card (Stripe)</option>
                <option value="cash_app">Cash App</option>
                <option value="paypal">PayPal</option>
                <option value="square">Square</option>
                <option value="venmo">Venmo</option>
                <option value="zelle">Zelle</option>
                <option value="manual">Manual</option>
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
                    <TableHead>Method</TableHead>
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
                        <TableCell><Skeleton className="h-4 w-14" /></TableCell>
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
                        <TableCell>{labelize(donation.paymentMethod ?? "stripe")}</TableCell>
                        <TableCell>{labelize(donation.donationType)}</TableCell>
                        <TableCell className="text-right font-medium">{dollars(donation.amountCents)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="py-12 text-center">
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
  return status === "succeeded" ? "default" : status === "failed" || status === "refunded" || status === "disputed" ? "destructive" : "secondary";
}

const RECORDABLE_METHODS: { value: string; label: string }[] = [
  { value: "manual", label: "Cash / Check" },
  { value: "zelle", label: "Zelle" },
  { value: "cash_app", label: "Cash App (direct)" },
  { value: "venmo", label: "Venmo (direct)" },
  { value: "paypal", label: "PayPal (direct)" },
  { value: "square", label: "Square (offline record)" },
  { value: "square_card", label: "In-Person Card (Square)" },
];

function RecordDonationDialog({ campaigns, onRecorded }: { campaigns: GivingCampaign[]; onRecorded: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [donorMode, setDonorMode] = React.useState<"member" | "visitor">("member");
  const [memberSearch, setMemberSearch] = React.useState("");
  const [selectedMember, setSelectedMember] = React.useState<MemberOption | null>(null);
  const [visitorName, setVisitorName] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [category, setCategory] = React.useState<GivingCategory>("tithe");
  const [payMethod, setPayMethod] = React.useState("manual");
  const [donationDate, setDonationDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [campaignId, setCampaignId] = React.useState("");
  const [note, setNote] = React.useState("");
  const [taxDeductible, setTaxDeductible] = React.useState(true);
  const [squareLink, setSquareLink] = React.useState<string | null>(null);
  const [squareIntentId, setSquareIntentId] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const membersQuery = useQuery({
    queryKey: ["record-donation-member-search", memberSearch],
    queryFn: () => apiJson<{ members: MemberOption[] }>(`/admin/members?search=${encodeURIComponent(memberSearch)}`),
    enabled: open && donorMode === "member" && memberSearch.trim().length >= 2 && !selectedMember,
  });

  const intentQuery = useQuery({
    queryKey: ["record-donation-intent", squareIntentId],
    queryFn: () => apiJson<{ intent: { id: number; status: string } }>(`/admin/giving/intents/${squareIntentId}`),
    enabled: squareIntentId !== null,
    refetchInterval: 3000,
  });

  React.useEffect(() => {
    if (intentQuery.data?.intent.status === "completed") {
      toast({ title: "Card payment received", description: "The donation has been recorded." });
      setSquareIntentId(null);
      setSquareLink(null);
      setOpen(false);
      onRecorded();
    }
  }, [intentQuery.data?.intent.status]);

  function reset() {
    setDonorMode("member");
    setMemberSearch("");
    setSelectedMember(null);
    setVisitorName("");
    setAmount("");
    setCategory("tithe");
    setPayMethod("manual");
    setDonationDate(new Date().toISOString().slice(0, 10));
    setCampaignId("");
    setNote("");
    setTaxDeductible(true);
    setSquareLink(null);
    setSquareIntentId(null);
    setError(null);
  }

  const record = useMutation({
    mutationFn: async () => {
      const donor = donorMode === "member"
        ? { memberId: selectedMember?.id }
        : { donorName: visitorName.trim() || undefined };
      if (payMethod === "square_card") {
        return apiJson<{ setupRequired?: boolean; message?: string; intentId?: number; paymentUrl?: string }>("/admin/giving/in-person", {
          method: "POST",
          body: JSON.stringify({ ...donor, amount: Number(amount), givingCategory: category, campaignId: campaignId ? Number(campaignId) : undefined }),
        });
      }
      return apiJson<{ donation: Donation }>("/admin/giving/donations", {
        method: "POST",
        body: JSON.stringify({
          ...donor,
          amount: Number(amount),
          givingCategory: category,
          paymentMethod: payMethod,
          donationDate,
          campaignId: campaignId ? Number(campaignId) : undefined,
          note: note.trim() || undefined,
          taxDeductible,
        }),
      });
    },
    onSuccess: (data: { setupRequired?: boolean; message?: string; intentId?: number; paymentUrl?: string; donation?: Donation }) => {
      if (data.setupRequired) {
        setError(data.message ?? "Square is not connected yet.");
        return;
      }
      if (data.paymentUrl && data.intentId) {
        setSquareLink(data.paymentUrl);
        setSquareIntentId(data.intentId);
        return;
      }
      toast({ title: "Donation recorded", description: "The gift was added to the giving ledger." });
      setOpen(false);
      reset();
      onRecorded();
    },
    onError: (err: Error) => setError(err.message),
  });

  function submit() {
    setError(null);
    const amountNumber = Number(amount);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) { setError("Enter an amount greater than $0."); return; }
    if (donorMode === "member" && !selectedMember) { setError("Select a member, or switch to Visitor / anonymous."); return; }
    record.mutate();
  }

  const memberResults = membersQuery.data?.members ?? [];

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="secondary"><HandCoins className="mr-2 h-4 w-4" /> Record Donation</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record a Donation</DialogTitle>
          <DialogDescription>Log a gift received by cash, check, Zelle, direct app payment — or take an in-person card payment.</DialogDescription>
        </DialogHeader>

        {squareLink ? (
          <div className="space-y-4">
            <div className="rounded-md border border-blue-100 bg-blue-50/60 p-4 text-sm">
              <p className="font-medium">Square payment page is ready.</p>
              <p className="mt-1 text-muted-foreground">Open it on this device (or send it to the giver) to take the card payment. This dialog updates automatically when the payment completes.</p>
            </div>
            <Button asChild className="w-full">
              <a href={squareLink} target="_blank" rel="noreferrer">Open Square payment page</a>
            </Button>
            <p className="text-center text-sm text-muted-foreground">Waiting for payment…</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" size="sm" variant={donorMode === "member" ? "default" : "outline"} onClick={() => setDonorMode("member")}>Member</Button>
              <Button type="button" size="sm" variant={donorMode === "visitor" ? "default" : "outline"} onClick={() => { setDonorMode("visitor"); setSelectedMember(null); }}>Visitor / anonymous</Button>
            </div>

            {donorMode === "member" ? (
              selectedMember ? (
                <div className="flex items-center justify-between rounded-md border border-blue-100 bg-blue-50/50 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{selectedMember.firstName} {selectedMember.lastName}</p>
                    <p className="text-xs text-muted-foreground">{selectedMember.email}</p>
                  </div>
                  <Button type="button" size="sm" variant="ghost" onClick={() => { setSelectedMember(null); setMemberSearch(""); }}>Change</Button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="record-member-search">Find member</Label>
                  <Input id="record-member-search" placeholder="Search by name, email, or phone" value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} />
                  {memberSearch.trim().length >= 2 && (
                    <div className="max-h-44 overflow-y-auto rounded-md border">
                      {membersQuery.isLoading ? (
                        <p className="px-3 py-2 text-sm text-muted-foreground">Searching…</p>
                      ) : memberResults.length > 0 ? (
                        memberResults.slice(0, 8).map((member) => (
                          <button key={member.id} type="button" className="flex w-full flex-col px-3 py-2 text-left hover:bg-blue-50" onClick={() => setSelectedMember(member)}>
                            <span className="text-sm font-medium">{member.firstName} {member.lastName}</span>
                            <span className="text-xs text-muted-foreground">{member.email}</span>
                          </button>
                        ))
                      ) : (
                        <p className="px-3 py-2 text-sm text-muted-foreground">No members match that search.</p>
                      )}
                    </div>
                  )}
                </div>
              )
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="record-visitor-name">Giver name (optional)</Label>
                <Input id="record-visitor-name" placeholder="e.g. First-time visitor" value={visitorName} onChange={(event) => setVisitorName(event.target.value)} />
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="record-amount">Amount (USD)</Label>
                <Input id="record-amount" type="number" min="0.01" step="0.01" placeholder="100.00" value={amount} onChange={(event) => setAmount(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="record-method">Method</Label>
                <select id="record-method" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" value={payMethod} onChange={(event) => setPayMethod(event.target.value)}>
                  {RECORDABLE_METHODS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="record-category">Giving Type</Label>
                <select id="record-category" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" value={category} onChange={(event) => setCategory(event.target.value as GivingCategory)}>
                  <option value="love_offering">Love Offering</option>
                  <option value="tithe">Tithe</option>
                  <option value="kingdom_commitment">Kingdom Commitment</option>
                  <option value="giftings">Giftings</option>
                </select>
              </div>
              {payMethod !== "square_card" && (
                <div className="space-y-1.5">
                  <Label htmlFor="record-date">Date received</Label>
                  <Input id="record-date" type="date" value={donationDate} onChange={(event) => setDonationDate(event.target.value)} />
                </div>
              )}
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="record-campaign">Campaign (optional)</Label>
                <select id="record-campaign" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" value={campaignId} onChange={(event) => setCampaignId(event.target.value)}>
                  <option value="">No campaign</option>
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>{campaign.campaignName}</option>
                  ))}
                </select>
              </div>
            </div>

            {payMethod !== "square_card" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="record-note">Note (optional)</Label>
                  <Input id="record-note" placeholder="e.g. Zelle memo, check number" value={note} onChange={(event) => setNote(event.target.value)} />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={taxDeductible} onChange={(event) => setTaxDeductible(event.target.checked)} />
                  Tax deductible
                </label>
              </>
            )}

            {error && <p className="text-sm font-medium text-red-600">{error}</p>}

            <Button className="w-full" onClick={submit} disabled={record.isPending}>
              {record.isPending ? "Saving…" : payMethod === "square_card" ? "Create card payment" : "Record donation"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function GivingReportsCard() {
  const [month, setMonth] = React.useState(new Date().toISOString().slice(0, 7));
  const [expanded, setExpanded] = React.useState(true);

  const monthStart = `${month}-01`;
  const monthEnd = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).toISOString().slice(0, 10);

  const summaryQuery = useQuery({
    queryKey: ["admin-giving-reports", "summary", month],
    queryFn: () => apiJson<ReportSummary>(`/admin/giving/reports/summary?from=${monthStart}&to=${monthEnd}`),
  });
  const topDonorsQuery = useQuery({
    queryKey: ["admin-giving-reports", "top-donors", month],
    queryFn: () => apiJson<TopDonorsReport>(`/admin/giving/reports/top-donors?from=${monthStart}&to=${monthEnd}&limit=10`),
  });

  const report = summaryQuery.data;
  const topDonors = topDonorsQuery.data;

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <CollapsibleTrigger asChild>
              <button type="button" className="flex items-start gap-2 text-left">
                <Trophy className="mt-0.5 h-5 w-5 text-amber-500" />
                <div>
                  <CardTitle>Monthly Report &amp; Top Donors</CardTitle>
                  <CardDescription>Totals by category and method, plus your most generous givers for the month.</CardDescription>
                </div>
                <ChevronDown className={`mt-1 h-4 w-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
              </button>
            </CollapsibleTrigger>
            <Input type="month" className="w-44" value={month} onChange={(event) => event.target.value && setMonth(event.target.value)} aria-label="Report month" />
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-6">
            {summaryQuery.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-lg border border-blue-100 bg-white p-4">
                    <p className="text-sm text-muted-foreground">Total giving</p>
                    <p className="mt-1 text-2xl font-semibold">{dollars(report?.totalCents ?? 0)}</p>
                  </div>
                  <div className="rounded-lg border border-blue-100 bg-white p-4">
                    <p className="text-sm text-muted-foreground">Gifts</p>
                    <p className="mt-1 text-2xl font-semibold">{report?.count ?? 0}</p>
                  </div>
                  <div className="rounded-lg border border-blue-100 bg-white p-4">
                    <p className="text-sm text-muted-foreground">Unique donors</p>
                    <p className="mt-1 text-2xl font-semibold">{report?.donorsCount ?? 0}</p>
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-muted-foreground">By category</h3>
                    {report && report.byCategory.length > 0 ? (
                      <div className="space-y-2">
                        {report.byCategory.map((group) => (
                          <div key={group.key} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                            <span>{labelize(group.key)} <span className="text-xs text-muted-foreground">({group.count})</span></span>
                            <span className="font-medium">{dollars(group.totalCents)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No gifts this month.</p>
                    )}
                  </div>
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-muted-foreground">By payment method</h3>
                    {report && report.byMethod.length > 0 ? (
                      <div className="space-y-2">
                        {report.byMethod.map((group) => (
                          <div key={group.key} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                            <span>{labelize(group.key)} <span className="text-xs text-muted-foreground">({group.count})</span></span>
                            <span className="font-medium">{dollars(group.totalCents)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No gifts this month.</p>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Top donors</h3>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">#</TableHead>
                          <TableHead>Donor</TableHead>
                          <TableHead>Gifts</TableHead>
                          <TableHead>Last Gift</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {topDonorsQuery.isLoading ? (
                          <TableRow><TableCell colSpan={5}><Skeleton className="h-4 w-full" /></TableCell></TableRow>
                        ) : topDonors && topDonors.donors.length > 0 ? (
                          <>
                            {topDonors.donors.map((donor, index) => (
                              <TableRow key={donor.memberId}>
                                <TableCell className="font-medium">{index + 1}</TableCell>
                                <TableCell>
                                  <div className="font-medium">{donor.name}</div>
                                  {donor.email && <div className="text-xs text-muted-foreground">{donor.email}</div>}
                                </TableCell>
                                <TableCell>{donor.giftCount}</TableCell>
                                <TableCell>{formatDate(donor.lastGiftDate)}</TableCell>
                                <TableCell className="text-right font-medium">{dollars(donor.totalCents)}</TableCell>
                              </TableRow>
                            ))}
                            {topDonors.unattributed.count > 0 && (
                              <TableRow>
                                <TableCell />
                                <TableCell className="text-muted-foreground">Unattributed gifts (no member linked)</TableCell>
                                <TableCell className="text-muted-foreground">{topDonors.unattributed.count}</TableCell>
                                <TableCell />
                                <TableCell className="text-right text-muted-foreground">{dollars(topDonors.unattributed.totalCents)}</TableCell>
                              </TableRow>
                            )}
                          </>
                        ) : (
                          <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">No donors recorded for this month yet.</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

const RESOLVE_CATEGORY_OPTIONS: { value: GivingCategory; label: string }[] = [
  { value: "love_offering", label: "Love Offering" },
  { value: "tithe", label: "Tithe" },
  { value: "kingdom_commitment", label: "Kingdom Commitment" },
  { value: "giftings", label: "Giftings" },
];

function UnmatchedQueueCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = React.useState(false);
  const [resolvingId, setResolvingId] = React.useState<number | null>(null);
  const [memberSearch, setMemberSearch] = React.useState("");
  const [selectedMember, setSelectedMember] = React.useState<MemberOption | null>(null);
  const [category, setCategory] = React.useState<GivingCategory>("tithe");

  const queueQuery = useQuery({
    queryKey: ["admin-giving-unmatched"],
    queryFn: () => apiJson<{ items: UnmatchedDonation[] }>("/admin/giving/unmatched?status=pending"),
  });

  const memberResultsQuery = useQuery({
    queryKey: ["unmatched-member-search", memberSearch],
    queryFn: () => apiJson<{ members: MemberOption[] }>(`/admin/members?search=${encodeURIComponent(memberSearch)}`),
    enabled: resolvingId !== null && memberSearch.trim().length >= 2 && !selectedMember,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-giving-unmatched"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-giving-donations"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-giving-summary"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-giving-reports"] });
  };

  function resetResolveForm() {
    setResolvingId(null);
    setMemberSearch("");
    setSelectedMember(null);
    setCategory("tithe");
  }

  const resolve = useMutation({
    mutationFn: (params: { id: number; action: string; extra?: Record<string, unknown> }) =>
      apiJson(`/admin/giving/unmatched/${params.id}/resolve`, {
        method: "POST",
        body: JSON.stringify({ action: params.action, givingCategory: category, ...params.extra }),
      }),
    onSuccess: () => {
      toast({ title: "Donation resolved" });
      resetResolveForm();
      invalidate();
    },
    onError: (error: Error) => toast({ title: "Could not resolve donation", description: error.message, variant: "destructive" }),
  });

  const items = queueQuery.data?.items ?? [];
  const memberResults = memberResultsQuery.data?.members ?? [];
  const activeItem = items.find((item) => item.id === resolvingId) ?? null;

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <Card>
        <CardHeader>
          <CollapsibleTrigger asChild>
            <button type="button" className="flex w-full items-start justify-between gap-4 text-left">
              <div className="flex items-start gap-2">
                <Inbox className="mt-0.5 h-5 w-5 text-amber-500" />
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Unmatched Donations
                    {items.length > 0 && <Badge variant="secondary">{items.length}</Badge>}
                  </CardTitle>
                  <CardDescription>Payments reported from Zelle, Cash App, Venmo, or PayPal that couldn't be automatically linked to a member.</CardDescription>
                </div>
              </div>
              <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
            </button>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-3">
            {queueQuery.isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : items.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No unmatched donations right now — nice work staying on top of the queue.</p>
            ) : (
              items.map((item) => (
                <div key={item.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{labelize(item.paymentMethod)}</Badge>
                        <span className="font-semibold">{dollars(item.amountCents)}</span>
                        <span className="text-sm text-muted-foreground">{formatDate(item.transactionDate)}</span>
                      </div>
                      <p className="mt-1 text-sm">
                        {item.senderName ?? item.senderHandle ?? item.senderEmail ?? item.senderPhone ?? "Unknown sender"}
                        {item.memo && <span className="text-muted-foreground"> — "{item.memo}"</span>}
                      </p>
                      {item.suggestedMatches && item.suggestedMatches.length > 0 && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Suggested: member #{item.suggestedMatches[0].memberId} ({item.suggestedMatches[0].confidence}% confidence — {item.suggestedMatches[0].reasons[0]})
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => { setResolvingId(item.id); setCategory(item.givingCategory ?? "tithe"); }}>
                        <Link2 className="mr-1.5 h-4 w-4" /> Link to member
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => resolve.mutate({ id: item.id, action: "anonymous" })}>
                        <UserX className="mr-1.5 h-4 w-4" /> Anonymous
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => resolve.mutate({ id: item.id, action: "ignore" })}>Ignore</Button>
                      <Button size="sm" variant="ghost" onClick={() => resolve.mutate({ id: item.id, action: "duplicate" })}>Duplicate</Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>

      <Dialog open={resolvingId !== null} onOpenChange={(open) => { if (!open) resetResolveForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Link Donation to Member</DialogTitle>
            <DialogDescription>
              {activeItem && `${dollars(activeItem.amountCents)} via ${labelize(activeItem.paymentMethod)} on ${formatDate(activeItem.transactionDate)}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedMember ? (
              <div className="flex items-center justify-between rounded-md border border-blue-100 bg-blue-50/50 px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{selectedMember.firstName} {selectedMember.lastName}</p>
                  <p className="text-xs text-muted-foreground">{selectedMember.email}</p>
                </div>
                <Button type="button" size="sm" variant="ghost" onClick={() => { setSelectedMember(null); setMemberSearch(""); }}>Change</Button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="unmatched-member-search">Find member</Label>
                <Input id="unmatched-member-search" placeholder="Search by name, email, or phone" value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} />
                {memberSearch.trim().length >= 2 && (
                  <div className="max-h-44 overflow-y-auto rounded-md border">
                    {memberResultsQuery.isLoading ? (
                      <p className="px-3 py-2 text-sm text-muted-foreground">Searching…</p>
                    ) : memberResults.length > 0 ? (
                      memberResults.slice(0, 8).map((member) => (
                        <button key={member.id} type="button" className="flex w-full flex-col px-3 py-2 text-left hover:bg-blue-50" onClick={() => setSelectedMember(member)}>
                          <span className="text-sm font-medium">{member.firstName} {member.lastName}</span>
                          <span className="text-xs text-muted-foreground">{member.email}</span>
                        </button>
                      ))
                    ) : (
                      <p className="px-3 py-2 text-sm text-muted-foreground">No members match that search.</p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="unmatched-category">Giving Type</Label>
              <select id="unmatched-category" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" value={category} onChange={(event) => setCategory(event.target.value as GivingCategory)}>
                {RESOLVE_CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <p className="text-xs text-muted-foreground">
              This sender's name, email, phone, and handle will be saved to {selectedMember ? `${selectedMember.firstName} ${selectedMember.lastName}'s` : "the member's"} profile, so future gifts from them match automatically.
            </p>

            <Button
              className="w-full"
              disabled={!selectedMember || resolve.isPending}
              onClick={() => {
                if (!resolvingId || !selectedMember) return;
                resolve.mutate({ id: resolvingId, action: "link", extra: { memberId: selectedMember.id } });
              }}
            >
              {resolve.isPending ? "Linking…" : "Link donation"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Collapsible>
  );
}
