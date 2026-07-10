import { useQuery } from "@tanstack/react-query";
import MemberLayout from "@/components/MemberLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  apiJson,
  dollars,
  type GivingCampaign,
} from "@/lib/giving";
import {
  Banknote,
  CreditCard,
  Gift,
  HeartHandshake,
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
    name: "Stripe",
    detail: "Card giving. Recurring giving available.",
    href: "https://buy.stripe.com/00g3g83mveETbXW000",
    badge: "Recurring available",
    icon: CreditCard,
  },
  {
    name: "PayPal",
    detail: "Give online with PayPal.",
    href: "https://www.paypal.com/paypalme/CJCPROPHETYOSEF?country.x=US&locale.x=en_US",
    icon: WalletCards,
  },
  {
    name: "Cash App",
    detail: "$Give2CJC",
    href: "https://cash.app/$Give2CJC",
    icon: Smartphone,
  },
  {
    name: "Venmo",
    detail: "@give2cjc",
    href: "https://account.venmo.com/u/give2cjc",
    icon: Banknote,
  },
  {
    name: "Zelle",
    detail: "Send via Zelle",
    phone: "703-488-0789",
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
        <section className="overflow-hidden rounded-xl border border-blue-100 bg-white shadow-sm">
          <div className="h-1 bg-gradient-to-r from-blue-500 via-blue-300 to-amber-300" />
          <div className="flex flex-col justify-between gap-5 p-5 lg:flex-row lg:items-center">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-700">
                <HeartHandshake className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Stewardship</p>
                <h1 className="truncate text-2xl font-semibold tracking-tight">Give</h1>
                <p className="mt-1 truncate text-sm text-muted-foreground">Choose a giving method below.</p>
              </div>
            </div>
          </div>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Giving Methods</CardTitle>
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
