import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/AdminLayout";
import StatCard from "@/components/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
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
import { Download, Megaphone, Pencil, Plus, Search, ShieldCheck } from "lucide-react";

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

const emptyCampaignForm: CampaignForm = {
  campaignName: "",
  description: "",
  goalAmount: "10000",
  status: "active",
  campaignCategory: "Special Campaign",
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

export default function AdminGiving() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [year, setYear] = React.useState(String(new Date().getFullYear()));
  const [category, setCategory] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [campaignOpen, setCampaignOpen] = React.useState(false);
  const [campaignForm, setCampaignForm] = React.useState<CampaignForm>(emptyCampaignForm);
  const [editingCampaign, setEditingCampaign] = React.useState<GivingCampaign | null>(null);

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
    queryKey: ["admin-giving-donations", search, year, category, status],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (year.trim()) params.set("year", year.trim());
      if (category) params.set("category", category);
      if (status) params.set("status", status);
      return apiJson<{ donations: Donation[] }>(`/admin/giving/donations?${params}`);
    },
  });

  const campaignsQuery = useQuery({
    queryKey: ["admin-giving-campaigns"],
    queryFn: () => apiJson<{ campaigns: GivingCampaign[] }>("/admin/giving/campaigns"),
  });

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
      toast({ title: "Campaign created" });
      void queryClient.invalidateQueries({ queryKey: ["admin-giving-campaigns"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-giving-summary"] });
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
      toast({ title: "Campaign updated" });
      void queryClient.invalidateQueries({ queryKey: ["admin-giving-campaigns"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-giving-summary"] });
    },
    onError: (error) => toast({ title: "Could not update campaign", description: error.message, variant: "destructive" }),
  });

  function openNewCampaign() {
    setEditingCampaign(null);
    setCampaignForm(emptyCampaignForm);
    setCampaignOpen(true);
  }

  function openEditCampaign(campaign: GivingCampaign) {
    setEditingCampaign(campaign);
    setCampaignForm(campaignToForm(campaign));
    setCampaignOpen(true);
  }

  const updateTaxStatus = useMutation({
    mutationFn: ({ id, taxDeductible }: { id: number; taxDeductible: boolean }) => apiJson<{ donation: Donation }>(`/admin/giving/donations/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ taxDeductible }),
    }),
    onSuccess: () => {
      toast({ title: "Donation updated" });
      void queryClient.invalidateQueries({ queryKey: ["admin-giving-donations"] });
    },
    onError: (error) => toast({ title: "Could not update donation", description: error.message, variant: "destructive" }),
  });

  const summary = summaryQuery.data;
  const donations = donationsQuery.data?.donations ?? [];
  const campaigns = campaignsQuery.data?.campaigns ?? [];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Finance</p>
            <h1 className="text-3xl font-semibold tracking-tight">Giving</h1>
          </div>
          <div className="flex flex-wrap gap-2">
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
                  setForm={setCampaignForm}
                  onSubmit={() => editingCampaign ? updateCampaign.mutate() : createCampaign.mutate()}
                  isSubmitting={createCampaign.isPending || updateCampaign.isPending}
                  submitLabel={editingCampaign ? "Save Changes" : "Create Campaign"}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Giving This Year" value={dollars(summary?.totalYearCents ?? 0)} trend="Succeeded donations" />
          <StatCard label="Giving This Month" value={dollars(summary?.totalMonthCents ?? 0)} trend="Current month" />
          <StatCard label="Recurring Giving" value={dollars(summary?.recurringCents ?? 0)} trend="Succeeded recurring gifts" />
          <StatCard label="Active Campaigns" value={String(summary?.activeCampaigns ?? 0)} trend={`${summary?.failedPayments ?? 0} failed payments`} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Security Boundary</CardTitle>
            <CardDescription>Giving records are only available to admins with giving permissions. Ministers do not receive this access by default.</CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Giving Records</CardTitle>
            <CardDescription>Search donations, review payment status, and mark tax-deductible records.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[1fr_120px_180px_160px]">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search donor name or email" value={search} onChange={(event) => setSearch(event.target.value)} />
              </div>
              <Input value={year} onChange={(event) => setYear(event.target.value)} placeholder="Year" />
              <select value={category} onChange={(event) => setCategory(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="">All categories</option>
                <option value="tithe">Tithe</option>
                <option value="offering">Offering</option>
                <option value="building_fund">Building Fund</option>
                <option value="missions">Missions</option>
                <option value="special_campaign">Special Campaign</option>
                <option value="other">Other</option>
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
                <TableHeader><TableRow><TableHead>Donor</TableHead><TableHead>Date</TableHead><TableHead>Category</TableHead><TableHead>Status</TableHead><TableHead>Tax</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                <TableBody>
                  {donations.map((donation) => (
                    <TableRow key={donation.id}>
                      <TableCell>
                        <div className="font-medium">{donation.donorName}</div>
                        <div className="text-xs text-muted-foreground">{donation.donorEmail}</div>
                      </TableCell>
                      <TableCell>{formatDate(donation.donationDate)}</TableCell>
                      <TableCell>{labelize(donation.givingCategory)}</TableCell>
                      <TableCell><Badge variant={statusVariant(donation.paymentStatus)}>{labelize(donation.paymentStatus)}</Badge></TableCell>
                      <TableCell>
                        <Checkbox checked={donation.taxDeductible} onCheckedChange={(checked) => updateTaxStatus.mutate({ id: donation.id, taxDeductible: checked === true })} aria-label="Tax deductible" />
                      </TableCell>
                      <TableCell className="text-right font-medium">{dollars(donation.amountCents)}</TableCell>
                    </TableRow>
                  ))}
                  {!donations.length && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No giving records found.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5" /> Campaigns</CardTitle>
            <CardDescription>Active campaigns appear on the member Give page.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
                <p className="mt-2 text-sm text-muted-foreground">{dollars(campaign.amountRaisedCents)} raised of {dollars(campaign.goalAmountCents)}</p>
                <Button className="mt-4 w-full" variant="secondary" onClick={() => openEditCampaign(campaign)}>
                  <Pencil className="mr-2 h-4 w-4" /> Manage Campaign
                </Button>
              </div>
            ))}
            {!campaigns.length && <p className="text-sm text-muted-foreground">No campaigns have been created.</p>}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

function CampaignFormView({
  form,
  setForm,
  onSubmit,
  isSubmitting,
  submitLabel,
}: {
  form: CampaignForm;
  setForm: (form: CampaignForm) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  submitLabel: string;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Campaign Name</Label>
          <Input value={form.campaignName} onChange={(event) => setForm({ ...form, campaignName: event.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Goal Amount</Label>
          <Input type="number" min="1" value={form.goalAmount} onChange={(event) => setForm({ ...form, goalAmount: event.target.value })} />
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
      <Button onClick={onSubmit} disabled={isSubmitting}>{submitLabel}</Button>
    </div>
  );
}

function statusVariant(status: PaymentStatus) {
  return status === "succeeded" ? "default" : status === "failed" || status === "refunded" ? "destructive" : "secondary";
}
