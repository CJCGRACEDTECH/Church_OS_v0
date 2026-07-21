import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import MemberLayout from "@/components/MemberLayout";
import PageHeader from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  apiJson,
  dollars,
  GIVING_CATEGORIES,
  type GivingCampaign,
  type GivingCategory,
  type GivingFrequency,
} from "@/lib/giving";
import {
  Banknote,
  CreditCard,
  Gift,
  HeartHandshake,
  Loader2,
  Smartphone,
  WalletCards,
} from "lucide-react";

type GivingChannel = {
  name: string;
  detail: string;
  href?: string;
  phone?: string;
  badge?: string;
  icon: React.ComponentType<{ className?: string }>;
};

const givingChannels: GivingChannel[] = [
  {
    name: "Zelle",
    detail: "Send via Zelle — include your full name in the memo so we can credit your giving record.",
    phone: "703-488-0789",
    icon: Gift,
  },
];

type OnlinePaymentMethod = "stripe" | "cash_app" | "paypal" | "venmo";

const METHOD_OPTIONS: { value: OnlinePaymentMethod; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "stripe", label: "Card", icon: CreditCard },
  { value: "cash_app", label: "Cash App", icon: Smartphone },
  { value: "paypal", label: "PayPal", icon: WalletCards },
  { value: "venmo", label: "Venmo", icon: Banknote },
];

const categoryDetails: Record<string, string> = {
  love_offering: "Special gifts and honor offerings.",
  tithe: "Regular tithe giving.",
  kingdom_commitment: "Committed giving for ministry growth.",
  giftings: "Designated gifts and ministry support.",
};

const FREQUENCY_OPTIONS: { value: GivingFrequency; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

type CheckoutResponse = {
  setupRequired?: boolean;
  message?: string;
  checkoutUrl?: string | null;
};

export default function MemberGive() {
  const campaignsQuery = useQuery({
    queryKey: ["giving-campaigns-member"],
    queryFn: () => apiJson<{ campaigns: GivingCampaign[] }>("/giving/campaigns"),
  });

  const campaigns = campaignsQuery.data?.campaigns ?? [];

  // PayPal appends its own order id as ?token=... when redirecting back
  // here; confirm the capture in case the webhook hasn't landed yet.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get("token");
    const checkoutStatus = params.get("checkout");
    if (checkoutStatus === "success" && orderId) {
      void apiJson("/giving/paypal/capture", { method: "POST", body: JSON.stringify({ orderId }) })
        .finally(() => window.history.replaceState({}, "", window.location.pathname));
    }
  }, []);

  return (
    <MemberLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          eyebrow="Stewardship"
          title="Give"
          description="Give securely online, or use one of our other giving methods."
          icon={<HeartHandshake className="h-6 w-6" />}
        />

        <OnlineGivingCard campaigns={campaigns} />

        <Card>
          <CardHeader>
            <CardTitle>Giving Types</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {GIVING_CATEGORIES.map((category) => (
              <div key={category.value} className="rounded-lg border border-blue-100 bg-white p-4">
                <h3 className="font-semibold">{category.label}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{categoryDetails[category.value]}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Other Giving Methods</CardTitle>
            <CardDescription>
              Gifts sent through these methods are added to your giving record by the finance team.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {givingChannels.map((channel) => (
              <GivingChannelCard key={channel.name} channel={channel} />
            ))}
          </CardContent>
        </Card>

        {campaigns.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Active Campaigns</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {campaigns.map((campaign) => (
                <div key={campaign.id} className="rounded-lg border border-blue-100 bg-white p-4">
                  {campaign.campaignImageUrl && <img src={campaign.campaignImageUrl} alt="" className="mb-4 h-32 w-full rounded-md object-cover" />}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{campaign.campaignName}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{campaign.description}</p>
                    </div>
                    <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">{campaign.progressPercent}%</Badge>
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
      </div>
    </MemberLayout>
  );
}

function OnlineGivingCard({ campaigns }: { campaigns: GivingCampaign[] }) {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<GivingCategory>("tithe");
  const [method, setMethod] = useState<OnlinePaymentMethod>("stripe");
  const [recurring, setRecurring] = useState(false);
  const [frequency, setFrequency] = useState<GivingFrequency>("monthly");
  const [campaignId, setCampaignId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const checkout = useMutation({
    mutationFn: () =>
      apiJson<CheckoutResponse>("/giving/checkout", {
        method: "POST",
        body: JSON.stringify({
          amount: Number(amount),
          givingCategory: category,
          donationType: recurring ? "recurring" : "one_time",
          frequency: recurring ? frequency : undefined,
          campaignId: campaignId ? Number(campaignId) : undefined,
          paymentMethod: method,
        }),
      }),
    onSuccess: (data) => {
      if (data.setupRequired) {
        setNotice(data.message ?? "Online giving is not available right now.");
        return;
      }
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      setError("Could not start checkout. Please try again.");
    },
    onError: (err: Error) => setError(err.message),
  });

  const submit = () => {
    setError(null);
    setNotice(null);
    const amountNumber = Number(amount);
    if (!Number.isFinite(amountNumber) || amountNumber < 1) {
      setError("Enter a giving amount of at least $1.00.");
      return;
    }
    checkout.mutate();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Give Online</CardTitle>
        <CardDescription>Pay securely by card, Cash App, PayPal, or Venmo. Every gift is recorded to your giving history automatically.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="give-amount">Amount (USD)</Label>
            <Input
              id="give-amount"
              type="number"
              min="1"
              step="0.01"
              placeholder="50.00"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="give-category">Giving Type</Label>
            <select
              id="give-category"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              value={category}
              onChange={(event) => setCategory(event.target.value as GivingCategory)}
            >
              {GIVING_CATEGORIES.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="give-campaign">Campaign (optional)</Label>
            <select
              id="give-campaign"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              value={campaignId}
              onChange={(event) => setCampaignId(event.target.value)}
            >
              <option value="">No campaign</option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>{campaign.campaignName}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Payment Method</Label>
            <div className="grid grid-cols-2 gap-2">
              {METHOD_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  variant={method === option.value ? "default" : "outline"}
                  onClick={() => {
                    setMethod(option.value);
                    if (option.value !== "stripe") setRecurring(false);
                  }}
                >
                  <option.icon className="mr-1.5 h-4 w-4" /> {option.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={recurring}
              disabled={method !== "stripe"}
              onChange={(event) => setRecurring(event.target.checked)}
            />
            Make this a recurring gift
          </label>
          {method !== "stripe" && (
            <span className="text-xs text-muted-foreground">Recurring gifts are only available with card giving right now.</span>
          )}
          {recurring && (
            <select
              aria-label="Giving frequency"
              className="flex h-8 rounded-md border border-input bg-transparent px-2 text-sm shadow-sm"
              value={frequency}
              onChange={(event) => setFrequency(event.target.value as GivingFrequency)}
            >
              {FREQUENCY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          )}
        </div>

        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        {notice && <p className="text-sm font-medium text-amber-700">{notice}</p>}

        <Button onClick={submit} disabled={checkout.isPending} className="w-full md:w-auto">
          {checkout.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Starting secure checkout…
            </>
          ) : (
            <>Give {amount && Number(amount) > 0 ? `$${Number(amount).toFixed(2)}` : "now"}</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

function GivingChannelCard({ channel }: { channel: GivingChannel }) {
  const Icon = channel.icon;

  return (
    <div className="flex flex-col rounded-lg border border-blue-100 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-700">
          <Icon className="h-5 w-5" />
        </div>
        {channel.badge && <Badge variant="secondary" className="bg-amber-50 text-amber-700">{channel.badge}</Badge>}
      </div>
      <div className="mt-3 flex-1">
        <h3 className="font-semibold">{channel.name}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{channel.detail}</p>
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
