import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import MemberLayout from "@/components/MemberLayout";
import PageHeader from "@/components/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  apiJson,
  dollars,
  formatDate,
  labelize,
  type Donation,
  type GivingCampaign,
  type GivingCategory,
  type GivingFrequency,
  type RecurringDonation,
} from "@/lib/giving";
import { CheckCircle2, HeartHandshake, Loader2, XCircle } from "lucide-react";

type GivingChannel = {
  name: string;
  detail: string;
  href?: string;
  phone?: string;
  badge?: string;
  logoSrc: string;
  logoClass?: string;
};

type CheckoutResponse = {
  setupRequired?: boolean;
  checkoutUrl: string | null;
  message?: string;
};

const givingChannels: GivingChannel[] = [
  {
    name: "PayPal",
    detail: "Give online with PayPal.",
    href: "https://www.paypal.com/paypalme/CJCPROPHETYOSEF?country.x=US&locale.x=en_US",
    logoSrc: "/logos/paypal.png",
    logoClass: "h-7 w-auto",
  },
  {
    name: "Cash App",
    detail: "$Give2CJC",
    href: "https://cash.app/$Give2CJC",
    logoSrc: "/logos/cashapp.png",
    logoClass: "h-11 w-11 rounded-xl object-contain",
  },
  {
    name: "Venmo",
    detail: "@give2cjc",
    href: "https://account.venmo.com/u/give2cjc",
    logoSrc: "/logos/venmo.png",
    logoClass: "h-9 w-auto object-contain",
  },
  {
    name: "Zelle",
    detail: "Send via Zelle — 703-488-0789",
    phone: "703-488-0789",
    logoSrc: "/logos/zelle.jpg",
    logoClass: "h-7 w-auto rounded",
  },
];

const PRESET_AMOUNTS = [25, 50, 100, 250];

export default function MemberGive() {
  const campaignsQuery = useQuery({
    queryKey: ["giving-campaigns-member"],
    queryFn: () => apiJson<{ campaigns: GivingCampaign[] }>("/giving/campaigns"),
  });

  const historyQuery = useQuery({
    queryKey: ["giving-history-member"],
    queryFn: () =>
      apiJson<{ donations: Donation[]; recurring: RecurringDonation[] }>("/giving/history"),
  });

  const campaigns = campaignsQuery.data?.campaigns ?? [];
  const donations = historyQuery.data?.donations ?? [];

  const checkoutResult = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("checkout");
  }, []);

  return (
    <MemberLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          eyebrow="Stewardship"
          title="Give"
          description="Give securely online, or choose another giving method below."
          icon={<HeartHandshake className="h-6 w-6" />}
        />

        {checkoutResult === "success" && (
          <Alert className="border-green-200 bg-green-50 text-green-800">
            <CheckCircle2 className="h-4 w-4 !text-green-600" />
            <AlertTitle>Thank you for your gift!</AlertTitle>
            <AlertDescription>
              Your donation is being confirmed and will appear in your giving history shortly.
            </AlertDescription>
          </Alert>
        )}
        {checkoutResult === "cancelled" && (
          <Alert className="border-amber-200 bg-amber-50 text-amber-800">
            <XCircle className="h-4 w-4 !text-amber-600" />
            <AlertTitle>Checkout cancelled</AlertTitle>
            <AlertDescription>No payment was made. You can try again anytime.</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <GiveOnlineCard campaigns={campaigns} />
          </div>
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Other Giving Methods</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {givingChannels.map((channel) => (
                <GivingChannelCard key={channel.name} channel={channel} />
              ))}
            </CardContent>
          </Card>
        </div>

        {campaigns.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Active Campaigns</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {campaigns.map((campaign) => (
                <div key={campaign.id} className="rounded-lg border border-blue-100 bg-white p-4">
                  {campaign.campaignImageUrl && (
                    <img
                      src={campaign.campaignImageUrl}
                      alt=""
                      className="mb-4 h-32 w-full rounded-md object-cover"
                    />
                  )}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{campaign.campaignName}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{campaign.description}</p>
                    </div>
                    <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                      {campaign.progressPercent}%
                    </Badge>
                  </div>
                  <Progress className="mt-4" value={campaign.progressPercent} />
                  <p className="mt-2 text-sm text-muted-foreground">
                    {dollars(campaign.amountRaisedCents)} raised of {dollars(campaign.goalAmountCents)}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {donations.length > 0 && <GivingHistoryCard donations={donations} />}
      </div>
    </MemberLayout>
  );
}

function GiveOnlineCard({ campaigns }: { campaigns: GivingCampaign[] }) {
  const { toast } = useToast();
  const [amount, setAmount] = useState<string>("");
  const [category, setCategory] = useState<GivingCategory>("tithe");
  const [donationType, setDonationType] = useState<"one_time" | "recurring">("one_time");
  const [frequency, setFrequency] = useState<GivingFrequency>("monthly");
  const [campaignId, setCampaignId] = useState<string>("none");
  const [submitting, setSubmitting] = useState(false);

  const amountNumber = Number(amount);
  const amountValid = Number.isFinite(amountNumber) && amountNumber >= 1;

  async function startCheckout() {
    if (!amountValid || submitting) return;
    setSubmitting(true);
    try {
      const response = await apiJson<CheckoutResponse>("/giving/checkout", {
        method: "POST",
        body: JSON.stringify({
          amount: amountNumber,
          givingCategory: category,
          donationType,
          frequency: donationType === "recurring" ? frequency : undefined,
          campaignId: campaignId !== "none" ? Number(campaignId) : undefined,
        }),
      });
      if (response.setupRequired || !response.checkoutUrl) {
        toast({
          title: "Online giving unavailable",
          description:
            response.message ??
            "Online giving is not available right now. Please use another giving method.",
          variant: "destructive",
        });
        return;
      }
      window.location.assign(response.checkoutUrl);
    } catch (error) {
      toast({
        title: "Something went wrong",
        description:
          error instanceof Error ? error.message : "Could not start checkout. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Give Online</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="give-amount">Amount</Label>
          <div className="flex flex-wrap gap-2">
            {PRESET_AMOUNTS.map((preset) => (
              <Button
                key={preset}
                type="button"
                size="sm"
                variant={amount === String(preset) ? "default" : "outline"}
                onClick={() => setAmount(String(preset))}
              >
                ${preset}
              </Button>
            ))}
          </div>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">
              $
            </span>
            <Input
              id="give-amount"
              type="number"
              min="1"
              step="0.01"
              inputMode="decimal"
              placeholder="Other amount"
              className="pl-7"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Giving category</Label>
            <Select value={category} onValueChange={(value) => setCategory(value as GivingCategory)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tithe">Tithe</SelectItem>
                <SelectItem value="offering">Offering</SelectItem>
                <SelectItem value="building_fund">Building Fund</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Frequency</Label>
            <Select
              value={donationType === "one_time" ? "one_time" : frequency}
              onValueChange={(value) => {
                if (value === "one_time") {
                  setDonationType("one_time");
                } else {
                  setDonationType("recurring");
                  setFrequency(value as GivingFrequency);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="one_time">One time</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="biweekly">Every 2 weeks</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {campaigns.length > 0 && (
          <div className="space-y-2">
            <Label>Campaign (optional)</Label>
            <Select value={campaignId} onValueChange={setCampaignId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">General giving</SelectItem>
                {campaigns.map((campaign) => (
                  <SelectItem key={campaign.id} value={String(campaign.id)}>
                    {campaign.campaignName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Button className="w-full" size="lg" disabled={!amountValid || submitting} onClick={startCheckout}>
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Redirecting to secure checkout…
            </>
          ) : (
            <>Give {amountValid ? dollars(Math.round(amountNumber * 100)) : ""}</>
          )}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          You'll be redirected to Stripe's secure checkout. Card details never touch Church OS servers.
        </p>
      </CardContent>
    </Card>
  );
}

const STATUS_STYLES: Record<Donation["paymentStatus"], string> = {
  succeeded: "border-green-200 bg-green-50 text-green-700",
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  failed: "border-red-200 bg-red-50 text-red-700",
  refunded: "border-gray-200 bg-gray-50 text-gray-600",
};

function GivingHistoryCard({ donations }: { donations: Donation[] }) {
  const years = useMemo(
    () =>
      Array.from(
        new Set(
          donations
            .filter((donation) => donation.paymentStatus === "succeeded")
            .map((donation) => new Date(donation.donationDate).getFullYear()),
        ),
      ).sort((a, b) => b - a),
    [donations],
  );

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <CardTitle>Your Giving History</CardTitle>
        <div className="flex flex-wrap gap-2">
          {years.map((year) => (
            <Button key={year} asChild variant="outline" size="sm">
              <a href={`/api/giving/receipts/${year}`} target="_blank" rel="noreferrer">
                {year} receipt
              </a>
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="divide-y">
        {donations.slice(0, 10).map((donation) => (
          <div key={donation.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div>
              <p className="font-medium">{dollars(donation.amountCents)}</p>
              <p className="text-sm text-muted-foreground">
                {formatDate(donation.donationDate)} · {labelize(donation.givingCategory)}
                {donation.campaignName ? ` · ${donation.campaignName}` : ""}
                {donation.donationType === "recurring" ? " · Recurring" : ""}
              </p>
            </div>
            <Badge variant="outline" className={STATUS_STYLES[donation.paymentStatus]}>
              {labelize(donation.paymentStatus)}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function GivingChannelCard({ channel }: { channel: GivingChannel }) {
  return (
    <div className="flex flex-col rounded-lg border border-blue-100 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-12 items-center">
          <img
            src={channel.logoSrc}
            alt={channel.name}
            className={channel.logoClass ?? "h-8 w-auto object-contain"}
          />
        </div>
        {channel.badge && (
          <Badge variant="secondary" className="bg-amber-50 text-amber-700">
            {channel.badge}
          </Badge>
        )}
      </div>
      <div className="mt-3 flex-1">
        <p className="text-sm text-muted-foreground">{channel.detail}</p>
      </div>
      {channel.href ? (
        <Button asChild className="mt-3 w-full" size="sm">
          <a href={channel.href} target="_blank" rel="noreferrer">
            Give with {channel.name}
          </a>
        </Button>
      ) : (
        <div className="mt-3 rounded-md border border-dashed border-blue-100 bg-blue-50/50 px-3 py-2 text-center text-sm font-medium text-blue-700">
          {channel.phone ?? channel.detail}
        </div>
      )}
    </div>
  );
}
