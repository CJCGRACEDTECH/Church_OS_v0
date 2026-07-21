import { useQuery } from "@tanstack/react-query";
import MemberLayout from "@/components/MemberLayout";
import PageHeader from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  apiJson,
  dollars,
  type GivingCampaign,
} from "@/lib/giving";
import { HeartHandshake } from "lucide-react";

type GivingChannel = {
  name: string;
  detail: string;
  href?: string;
  phone?: string;
  badge?: string;
  logoSrc: string;
  logoClass?: string;
};

const givingChannels: GivingChannel[] = [
  {
    name: "Stripe",
    detail: "Card giving. Recurring giving available.",
    href: "https://buy.stripe.com/00g3g83mveETbXW000",
    badge: "Recurring available",
    logoSrc: "/logos/stripe.png",
    logoClass: "h-7 w-auto",
  },
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

export default function MemberGive() {
  const campaignsQuery = useQuery({
    queryKey: ["giving-campaigns-member"],
    queryFn: () => apiJson<{ campaigns: GivingCampaign[] }>("/giving/campaigns"),
  });

  const campaigns = campaignsQuery.data?.campaigns ?? [];

  return (
    <MemberLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          eyebrow="Stewardship"
          title="Give"
          description="Choose a giving method below."
          icon={<HeartHandshake className="h-6 w-6" />}
        />

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
      </div>
    </MemberLayout>
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
