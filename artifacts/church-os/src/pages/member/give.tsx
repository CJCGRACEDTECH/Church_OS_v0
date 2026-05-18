import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import MemberLayout from "@/components/MemberLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  apiJson,
  dollars,
  formatDate,
  labelize,
  type Donation,
  type DonationType,
  type GivingCampaign,
  type GivingCategory,
  type GivingFrequency,
  type RecurringDonation,
} from "@/lib/giving";
import { CalendarClock, Download, HeartHandshake, Receipt, Repeat, WalletCards } from "lucide-react";

type GivingForm = {
  amount: string;
  givingCategory: GivingCategory;
  donationType: DonationType;
  frequency: GivingFrequency;
  campaignId: string;
};

const currentYear = new Date().getFullYear();
const initialForm: GivingForm = {
  amount: "50",
  givingCategory: "tithe",
  donationType: "one_time",
  frequency: "monthly",
  campaignId: "",
};

export default function MemberGive() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [year, setYear] = React.useState(String(currentYear));
  const [form, setForm] = React.useState<GivingForm>(initialForm);
  const [setupMessage, setSetupMessage] = React.useState("");

  async function openReceipt() {
    try {
      const demoToken = sessionStorage.getItem("demo_token");
      const response = await fetch(`/api/giving/receipts/${year}`, {
        credentials: "include",
        headers: demoToken ? { authorization: `Bearer ${demoToken}` } : {},
      });
      if (!response.ok) throw new Error("Receipt could not be generated.");
      const html = await response.text();
      const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast({ title: "Receipt unavailable", description: error instanceof Error ? error.message : "Try again later.", variant: "destructive" });
    }
  }

  const campaignsQuery = useQuery({
    queryKey: ["giving-campaigns-member"],
    queryFn: () => apiJson<{ campaigns: GivingCampaign[] }>("/giving/campaigns"),
  });

  const historyQuery = useQuery({
    queryKey: ["giving-history", year],
    queryFn: () => apiJson<{ donations: Donation[]; recurring: RecurringDonation[] }>(`/giving/history?year=${year}`),
  });

  const checkout = useMutation({
    mutationFn: () => apiJson<{ checkoutUrl: string | null; setupRequired?: boolean; message?: string }>("/giving/checkout", {
      method: "POST",
      body: JSON.stringify({
        ...form,
        amount: Number(form.amount),
        campaignId: form.campaignId ? Number(form.campaignId) : null,
      }),
    }),
    onSuccess: (result) => {
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }
      setSetupMessage(result.message ?? "Stripe checkout is not configured yet.");
      toast({ title: "Stripe setup needed", description: result.message ?? "Add Stripe secrets in Replit before live giving." });
      void queryClient.invalidateQueries({ queryKey: ["giving-history"] });
    },
    onError: (error) => toast({ title: "Giving checkout failed", description: error.message, variant: "destructive" }),
  });

  const donations = historyQuery.data?.donations ?? [];
  const recurring = historyQuery.data?.recurring ?? [];
  const campaigns = campaignsQuery.data?.campaigns ?? [];
  const totalYear = donations.filter((donation) => donation.paymentStatus === "succeeded").reduce((sum, donation) => sum + donation.amountCents, 0);

  return (
    <MemberLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Stewardship</p>
            <h1 className="text-3xl font-semibold tracking-tight">Give</h1>
          </div>
          <Button variant="outline" onClick={openReceipt}>
            <Download className="mr-2 h-4 w-4" /> Year-End Receipt
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><HeartHandshake className="h-5 w-5" /> Give Now</CardTitle>
              <CardDescription>One-time and recurring gifts are sent through Stripe Checkout. Card details stay with Stripe.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount</Label>
                  <Input id="amount" type="number" min="1" step="1" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <select value={form.givingCategory} onChange={(event) => setForm({ ...form, givingCategory: event.target.value as GivingCategory })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option value="tithe">Tithe</option>
                    <option value="offering">Offering</option>
                    <option value="building_fund">Building Fund</option>
                    <option value="missions">Missions</option>
                    <option value="special_campaign">Special Campaign</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Giving Type</Label>
                  <select value={form.donationType} onChange={(event) => setForm({ ...form, donationType: event.target.value as DonationType })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option value="one_time">One-Time</option>
                    <option value="recurring">Recurring</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Frequency</Label>
                  <select disabled={form.donationType !== "recurring"} value={form.frequency} onChange={(event) => setForm({ ...form, frequency: event.target.value as GivingFrequency })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50">
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Biweekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Campaign</Label>
                  <select value={form.campaignId} onChange={(event) => setForm({ ...form, campaignId: event.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option value="">No campaign</option>
                    {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.campaignName}</option>)}
                  </select>
                </div>
              </div>
              {setupMessage && <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{setupMessage}</div>}
              <Button className="mt-5" onClick={() => checkout.mutate()} disabled={checkout.isPending}>
                <WalletCards className="mr-2 h-4 w-4" /> Continue to Stripe
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>This Year</CardTitle>
              <CardDescription>Your succeeded giving for {year}.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-3xl font-semibold">{dollars(totalYear)}</div>
              <div className="space-y-2">
                <Label>Receipt Year</Label>
                <Input value={year} onChange={(event) => setYear(event.target.value)} />
              </div>
              <Button className="w-full" variant="secondary" onClick={openReceipt}>
                <Receipt className="mr-2 h-4 w-4" /> Open Receipt
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Active Campaigns</CardTitle>
            <CardDescription>Donate toward church initiatives and track progress.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {campaigns.map((campaign) => (
              <div key={campaign.id} className="rounded-md border p-4">
                {campaign.campaignImageUrl && <img src={campaign.campaignImageUrl} alt="" className="mb-4 h-36 w-full rounded-md object-cover" />}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{campaign.campaignName}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{campaign.description}</p>
                  </div>
                  <Badge variant="outline">{campaign.progressPercent}%</Badge>
                </div>
                <Progress className="mt-4" value={campaign.progressPercent} />
                <p className="mt-2 text-sm text-muted-foreground">{dollars(campaign.amountRaisedCents)} raised of {dollars(campaign.goalAmountCents)}</p>
                <Button className="mt-4 w-full" variant="secondary" onClick={() => setForm({ ...form, givingCategory: "special_campaign", campaignId: String(campaign.id) })}>Give to Campaign</Button>
              </div>
            ))}
            {!campaigns.length && <p className="text-sm text-muted-foreground">No active campaigns yet.</p>}
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <Card>
            <CardHeader>
              <CardTitle>Giving History</CardTitle>
              <CardDescription>Only your own giving records are shown here.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Category</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                <TableBody>
                  {donations.map((donation) => (
                    <TableRow key={donation.id}>
                      <TableCell>{formatDate(donation.donationDate)}</TableCell>
                      <TableCell>{labelize(donation.givingCategory)}</TableCell>
                      <TableCell>{labelize(donation.donationType)}</TableCell>
                      <TableCell><Badge variant={donation.paymentStatus === "succeeded" ? "default" : "secondary"}>{labelize(donation.paymentStatus)}</Badge></TableCell>
                      <TableCell className="text-right font-medium">{dollars(donation.amountCents)}</TableCell>
                    </TableRow>
                  ))}
                  {!donations.length && <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No giving records for this year.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Repeat className="h-5 w-5" /> Recurring Giving</CardTitle>
              <CardDescription>Subscription status from Stripe checkout.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {recurring.map((gift) => (
                <div key={gift.id} className="rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{dollars(gift.amountCents)}</span>
                    <Badge variant={gift.status === "active" ? "default" : "secondary"}>{labelize(gift.status)}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{labelize(gift.frequency)} • {labelize(gift.givingCategory)}</p>
                  <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><CalendarClock className="h-3 w-3" /> Started {formatDate(gift.startDate)}</p>
                </div>
              ))}
              {!recurring.length && <p className="text-sm text-muted-foreground">No recurring gifts yet.</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </MemberLayout>
  );
}
