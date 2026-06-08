import { useQuery } from "@tanstack/react-query";
import MemberLayout from "@/components/MemberLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  apiJson,
  dollars,
  type GivingCampaign,
} from "@/lib/giving";
import {
  Banknote,
  CreditCard,
  ExternalLink,
  Gift,
  HeartHandshake,
  Landmark,
  Smartphone,
  WalletCards,
} from "lucide-react";

type GivingChannel = {
  name: string;
  description: string;
  detail: string;
  href?: string;
  badge?: string;
  icon: React.ComponentType<{ className?: string }>;
};

function envString(key: string) {
  const value = import.meta.env[key] as string | undefined;
  return value?.trim() || undefined;
}

const givingChannels: GivingChannel[] = [
  {
    name: "Cash App",
    description: "Mobile giving through Cash App.",
    detail: envString("VITE_GIVING_CASH_APP_LABEL") ?? "Cash App details are available from the finance team.",
    href: envString("VITE_GIVING_CASH_APP_URL"),
    icon: Smartphone,
  },
  {
    name: "Zelle",
    description: "Bank-to-bank giving.",
    detail: envString("VITE_GIVING_ZELLE_LABEL") ?? envString("VITE_GIVING_ZELLE_EMAIL") ?? "Zelle details are available from the finance team.",
    href: envString("VITE_GIVING_ZELLE_URL"),
    icon: Landmark,
  },
  {
    name: "Square",
    description: "Physical card transactions.",
    detail: envString("VITE_GIVING_SQUARE_LABEL") ?? "Use with a finance/admin team member for in-person card giving.",
    href: envString("VITE_GIVING_SQUARE_URL"),
    badge: "In person",
    icon: CreditCard,
  },
  {
    name: "PayPal",
    description: "Online giving through PayPal.",
    detail: envString("VITE_GIVING_PAYPAL_LABEL") ?? "PayPal giving details are available from the finance team.",
    href: envString("VITE_GIVING_PAYPAL_URL"),
    icon: WalletCards,
  },
  {
    name: "Venmo",
    description: "Mobile giving through Venmo.",
    detail: envString("VITE_GIVING_VENMO_LABEL") ?? "Venmo giving details are available from the finance team.",
    href: envString("VITE_GIVING_VENMO_URL"),
    icon: Banknote,
  },
  {
    name: "Stripe",
    description: "Online card and recurring giving.",
    detail: envString("VITE_GIVING_STRIPE_LABEL") ?? "Recurring gifts are managed through Stripe.",
    href: envString("VITE_GIVING_STRIPE_URL"),
    badge: "Recurring",
    icon: Gift,
  },
];

export default function MemberGive() {
  const campaignsQuery = useQuery({
    queryKey: ["giving-campaigns-member"],
    queryFn: () => apiJson<{ campaigns: GivingCampaign[] }>("/giving/campaigns"),
  });

  const campaigns = campaignsQuery.data?.campaigns ?? [];

  return (
    <MemberLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-lg border border-blue-100 bg-blue-50/70 p-5 shadow-sm">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-amber-200 bg-white text-amber-800">
                <HeartHandshake className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-muted-foreground">Stewardship</p>
                <h1 className="truncate text-2xl font-semibold tracking-tight">Give</h1>
                <p className="truncate text-sm text-muted-foreground">Choose a giving channel. Recurring gifts are managed through Stripe.</p>
              </div>
            </div>
          </div>
        </section>

        <Card className="overflow-hidden border-blue-100 bg-blue-50/45 shadow-sm">
          <div className="h-1 bg-amber-400" />
          <CardHeader>
            <CardTitle>Giving Methods</CardTitle>
            <CardDescription>
              Church OS does not store card details. Use the approved giving channels below.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {givingChannels.map((channel) => (
              <GivingChannelCard key={channel.name} channel={channel} />
            ))}
          </CardContent>
        </Card>

        {campaigns.length > 0 && (
          <Card className="overflow-hidden border-blue-100 bg-blue-50/45 shadow-sm">
            <div className="h-1 bg-blue-500" />
            <CardHeader>
              <CardTitle>Current Giving Focus</CardTitle>
              <CardDescription>Use any giving method above and include the campaign name in the memo when needed.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {campaigns.map((campaign) => (
                <div key={campaign.id} className="rounded-lg border border-blue-100 bg-white/75 p-4">
                  {campaign.campaignImageUrl && <img src={campaign.campaignImageUrl} alt="" className="mb-4 h-32 w-full rounded-md object-cover" />}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{campaign.campaignName}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{campaign.description}</p>
                    </div>
                    <Badge variant="outline" className="border-amber-200 bg-white text-amber-800">{campaign.progressPercent}%</Badge>
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

          <Card className="overflow-hidden border-blue-100 bg-blue-50/45 shadow-sm">
            <div className="h-1 bg-blue-500" />
            <CardHeader>
            <CardTitle>Giving Records</CardTitle>
            <CardDescription>Contact the finance team for giving history, receipts, and recurring gift updates.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-blue-100 bg-white/75 p-4 text-sm text-muted-foreground">
              Contact the church finance team for receipts, giving history, recurring gift updates, or questions about a transaction.
            </div>
          </CardContent>
        </Card>
      </div>
    </MemberLayout>
  );
}

function GivingChannelCard({ channel }: { channel: GivingChannel }) {
  const Icon = channel.icon;

  return (
    <div className="flex min-h-[210px] flex-col rounded-lg border border-blue-100 bg-white/75 p-4 transition-colors hover:bg-blue-50/60">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-amber-200 bg-white text-amber-800">
          <Icon className="h-5 w-5" />
        </div>
        {channel.badge && <Badge variant="secondary" className="bg-blue-100 text-blue-800">{channel.badge}</Badge>}
      </div>
      <div className="mt-4 flex-1">
        <h3 className="font-semibold">{channel.name}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{channel.description}</p>
        <p className="mt-3 text-sm">{channel.detail}</p>
      </div>
      {channel.href ? (
        <Button asChild className="mt-4 w-full">
          <a href={channel.href} target="_blank" rel="noreferrer">
            Open {channel.name}
            <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>
      ) : (
        <Button className="mt-4 w-full" variant="outline" disabled>
          Configure Link
        </Button>
      )}
    </div>
  );
}
