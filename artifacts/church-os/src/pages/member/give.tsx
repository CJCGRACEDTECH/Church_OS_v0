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
  logo: React.ReactNode;
};

function StripeLogo() {
  return (
    <svg viewBox="0 0 60 25" aria-label="Stripe" className="h-7 w-auto">
      <path
        d="M5.45 10.19c0-.66.54-.91 1.44-.91 1.29 0 2.91.39 4.2 1.08V6.54A11.17 11.17 0 006.89 6C3.73 6 1.6 7.61 1.6 10.37c0 4.35 5.99 3.66 5.99 5.54 0 .78-.68 1.03-1.63 1.03-1.41 0-3.21-.58-4.63-1.36v3.87A11.75 11.75 0 005.96 20.6c3.24 0 5.47-1.56 5.47-4.36C11.43 11.6 5.45 12.44 5.45 10.19zm11.73-7.12L13.7 3.6l-.03 13.17 4.04-.03.02-3.17c.67.86 1.67 1.38 3.03 1.38 2.73 0 5.22-2.13 5.22-6.41 0-4.05-2.52-6.41-5.22-6.41-1.37 0-2.37.55-3.08 1.44l.5-3.53zm.85 9.9c-.89 0-1.41-.32-1.78-.8l.02-3.12c.4-.51.93-.82 1.76-.82 1.35 0 2.28 1.08 2.28 2.37 0 1.3-.91 2.37-2.28 2.37zm8.4-9.41h4.06v13.19h-4.06V3.56zm4.06-1.21a2.03 2.03 0 11-4.06 0 2.03 2.03 0 014.06 0zM35.1 8.13c-2.19 0-3.52.95-3.52 2.61 0 2.9 4.01 2.44 4.01 3.69 0 .44-.39.68-1.02.68-.92 0-2.08-.37-3.01-.88v3.06a7.54 7.54 0 003.01.63c2.29 0 3.84-1.07 3.84-2.79 0-3.06-4.03-2.58-4.03-3.71 0-.37.33-.59.9-.59.79 0 1.77.3 2.61.72V8.74a7.52 7.52 0 00-2.79-.61zM47.49 8c-3.53 0-5.67 2.24-5.67 6.02 0 3.96 2.21 6.04 5.88 6.04 1.67 0 2.93-.38 3.99-1.08V15.8c-1.01.64-2.11.94-3.13.94-1.42 0-2.35-.54-2.62-1.82h6.6c.04-.29.08-.93.08-1.25 0-3.47-1.79-5.67-5.13-5.67zm-1.56 4.82c.14-1.33.88-2.14 1.84-2.14.99 0 1.65.78 1.65 2.14h-3.49z"
        fill="#635BFF"
      />
    </svg>
  );
}

function PayPalLogo() {
  return (
    <svg viewBox="0 0 101 32" aria-label="PayPal" className="h-8 w-auto">
      <path d="M12.237 2.8H5.523C5.1 2.8 4.74 3.107 4.676 3.526L1.892 21.98a.504.504 0 00.498.582h3.202c.422 0 .783-.307.848-.726l.76-4.82a.858.858 0 01.848-.727h2.145c4.455 0 7.026-2.156 7.697-6.43.303-1.87.012-3.34-.867-4.37-.966-1.13-2.676-1.68-4.826-1.68" fill="#003087"/>
      <path d="M13.14 9.27c-.37 2.42-2.218 2.42-4.007 2.42h-1.017l.714-4.524a.515.515 0 01.509-.434h.466c1.218 0 2.368 0 2.962.695.355.415.462 1.032.372 1.843" fill="#003087"/>
      <path d="M35.026 9.18h-3.213a.515.515 0 00-.51.433l-.132.836-.208-.302c-.645-.937-2.085-1.25-3.52-1.25-3.294 0-6.108 2.496-6.655 5.996-.284 1.746.12 3.416 1.104 4.577.904 1.066 2.195 1.51 3.731 1.51 2.656 0 4.13-1.707 4.13-1.707l-.133.83a.503.503 0 00.497.583h2.895c.423 0 .784-.307.849-.726l1.737-11.004a.504.504 0 00-.572-.576" fill="#003087"/>
      <path d="M27.172 15.31c-.287 1.71-1.634 2.858-3.363 2.858-.865 0-1.557-.278-2.001-.804-.44-.523-.607-1.267-.468-2.095.27-1.696 1.637-2.88 3.339-2.88.847 0 1.535.28 1.989.812.454.535.635 1.283.504 2.108" fill="#009CDE"/>
      <path d="M52.455 9.18h-3.226a.86.86 0 00-.71.377l-4.098 6.03-1.737-5.796a.858.858 0 00-.822-.61H38.68a.504.504 0 00-.478.667l3.27 9.593-3.075 4.341a.503.503 0 00.41.796h3.222a.855.855 0 00.707-.37l9.878-14.262a.503.503 0 00-.41-.766" fill="#003087"/>
      <path d="M62.442 2.8h-6.714c-.423 0-.784.307-.848.726L52.096 21.98a.504.504 0 00.497.582h3.428c.296 0 .548-.215.594-.51l.793-5.035a.858.858 0 01.848-.727h2.144c4.455 0 7.027-2.156 7.698-6.43.303-1.87.011-3.34-.868-4.37-.965-1.13-2.675-1.68-4.788-1.69" fill="#009CDE"/>
      <path d="M63.344 9.27c-.37 2.42-2.218 2.42-4.007 2.42h-1.017l.714-4.524a.515.515 0 01.509-.434h.466c1.218 0 2.368 0 2.962.695.355.415.463 1.032.373 1.843" fill="#009CDE"/>
      <path d="M85.23 9.18H82.02a.516.516 0 00-.51.433l-.132.836-.208-.302c-.645-.937-2.085-1.25-3.52-1.25-3.294 0-6.108 2.496-6.655 5.996-.284 1.746.12 3.416 1.104 4.577.904 1.066 2.195 1.51 3.731 1.51 2.656 0 4.13-1.707 4.13-1.707l-.133.83a.503.503 0 00.497.583h2.895c.423 0 .784-.307.849-.726L84.805 9.756a.504.504 0 00-.575-.576" fill="#009CDE"/>
      <path d="M77.378 15.31c-.288 1.71-1.635 2.858-3.363 2.858-.865 0-1.557-.278-2.002-.804-.44-.523-.607-1.267-.467-2.095.27-1.696 1.636-2.88 3.338-2.88.848 0 1.535.28 1.99.812.453.535.634 1.283.504 2.108" fill="#003087"/>
      <path d="M88.207 3.244l-2.829 17.998-.022.738h3.312c.422 0 .783-.307.848-.726L92.7 3.3a.503.503 0 00-.497-.582h-3.5a.515.515 0 00-.496.526" fill="#003087"/>
    </svg>
  );
}

function CashAppLogo() {
  return (
    <svg viewBox="0 0 40 40" aria-label="Cash App" className="h-10 w-10">
      <rect width="40" height="40" rx="8" fill="#00D632"/>
      <path
        d="M25.2 13.8l-1.2-1.2c-.2-.2-.5-.2-.7 0l-1 1c-1-.3-2-.4-3-.2-2.8.5-4.8 2.9-4.8 5.8 0 .8.2 1.6.5 2.3l-1.1 1.1c-.2.2-.2.5 0 .7l1.2 1.2c.2.2.5.2.7 0l1-.9c1 .3 2 .4 3.1.2 2.8-.5 4.8-3 4.7-5.9 0-.7-.2-1.4-.4-2l1-1c.3-.3.3-.7 0-.9l-.1-.1zm-7.7 8.5c-1.8-.5-3-2.2-2.8-4 .2-1.5 1.3-2.8 2.8-3.1.5-.1 1-.1 1.5 0l-2.2 2.2c-.2.2-.2.5 0 .7l1.5 1.5c.2.2.5.2.7 0l2.2-2.2c.1.5.1 1 0 1.5-.4 1.7-1.9 3-3.7 3.4z"
        fill="white"
      />
      <path
        d="M21.5 17.5h-1.1c-.3 0-.5-.2-.6-.5l-.2-.7h-1.2l-.2.7c-.1.3-.3.5-.6.5h-1.1c-.4 0-.6-.4-.5-.7l2-6c.1-.3.4-.5.7-.5h.9c.3 0 .6.2.7.5l2 6c.1.4-.2.7-.8.7zm-1.8-3l-.3-1.2-.3 1.2h.6z"
        fill="white"
      />
    </svg>
  );
}

function VenmoLogo() {
  return (
    <svg viewBox="0 0 120 34" aria-label="Venmo" className="h-7 w-auto">
      <path
        d="M17.7 1c.7 1.2 1 2.5 1 4.1 0 5.1-4.3 11.7-7.8 16.4H4.3L1.1 3.1l7.2-.7 1.8 14.5C12 13.7 14 8.7 14 5.1c0-2-.4-3.4-1-4.5L17.7 1zM35.2 10c0 6.2-5.2 10.6-9.8 10.6-2.8 0-4.6-1.3-4.6-3.4 0-3.7 3.8-5.9 11-5.9v-.7c0-1.5-.8-2.1-2.5-2.1-2 0-4.3.8-6 1.7l1-4.7c1.7-.8 4-1.4 6.6-1.4 4.1 0 5.7 1.8 5.7 5.2l-.4.7zM30 14.3v-.8c-4.1.1-5.4 1-5.4 2.4 0 .8.6 1.4 1.6 1.4 1.6 0 3.8-1.2 3.8-3zm22.8-10l-.7 2c-.5-.3-1.2-.5-2-.5-2 0-3.3 1.5-3.3 4.5v10.5h-5.7V4.6h5.5l-.3 2.7c.8-2 2.3-3 4.2-3 .8 0 1.6.3 2.3 1zm13.3 5.3c0-1.3-.6-2-1.8-2-1.9 0-3.2 1.6-3.2 5.2 0 3 .8 4.4 2.5 4.4 1.6 0 2.9-1.3 3.5-3.5l4.4 2c-1.2 3.3-4 5.3-8 5.3-5.2 0-8.3-3.1-8.3-8.4 0-6.1 3.8-9.7 8.9-9.7 3.9 0 6.8 2 7.8 5.1l-4.8 1.6zm24.2-5.2c0 0 0 16.5 0 16.5h-5.7v-9.5c0-2.2-.5-3.1-1.8-3.1-1.7 0-2.8 1.4-2.8 4.4v8.3h-5.7V4.7h5.5l-.1 2.6c1-2.1 2.9-3.1 5.4-3.1 3.5 0 5.2 2 5.2 6.2zM97.3 12c0-4.5 2.3-8.3 6.8-8.3 1.5 0 2.7.7 3.4 2.1V4h5.6v16.8h-5.5v-1.8c-.8 1.5-2.1 2.2-3.8 2.2-4 0-6.5-3.4-6.5-9.2zm10.3-.1c0-2.5-.8-4.1-2.6-4.1-1.7 0-2.4 1.3-2.4 4.1 0 2.8.7 4.1 2.4 4.1 1.7 0 2.6-1.4 2.6-4.1z"
        fill="#3D95CE"
      />
    </svg>
  );
}

function ZelleLogo() {
  return (
    <svg viewBox="0 0 80 28" aria-label="Zelle" className="h-7 w-auto">
      <defs>
        <linearGradient id="zelleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#6D1ED4"/>
          <stop offset="100%" stopColor="#A855F7"/>
        </linearGradient>
      </defs>
      <path
        d="M7.4 21.2H20l-1.7 4.7H0l7.2-19.7H1.4L3.1 1.6h18l-1.7 4.7H8.4L4.6 16.5h9.2l-2.2 6-4.2-1.3z"
        fill="url(#zelleGrad)"
      />
      <path
        d="M25 26H36.2l1.5-4.1H29l1.2-3.3h8l1.4-3.8H31.5l1-2.8h8.4l1.5-4.1H31.2L25 26zm19.5 0H55.7l1.5-4.1H49l6.1-14.1H48.8L44.5 26zm19.5 0H75.2l1.5-4.1h-8.2l1.2-3.3h8l1.4-3.8H71l1-2.8h8.4l1.5-4.1H70.2L64 26z"
        fill="url(#zelleGrad)"
      />
    </svg>
  );
}

const givingChannels: GivingChannel[] = [
  {
    name: "Stripe",
    detail: "Card giving. Recurring giving available.",
    href: "https://buy.stripe.com/00g3g83mveETbXW000",
    badge: "Recurring available",
    logo: <StripeLogo />,
  },
  {
    name: "PayPal",
    detail: "Give online with PayPal.",
    href: "https://www.paypal.com/paypalme/CJCPROPHETYOSEF?country.x=US&locale.x=en_US",
    logo: <PayPalLogo />,
  },
  {
    name: "Cash App",
    detail: "$Give2CJC",
    href: "https://cash.app/$Give2CJC",
    logo: <CashAppLogo />,
  },
  {
    name: "Venmo",
    detail: "@give2cjc",
    href: "https://account.venmo.com/u/give2cjc",
    logo: <VenmoLogo />,
  },
  {
    name: "Zelle",
    detail: "Send via Zelle",
    phone: "703-488-0789",
    logo: <ZelleLogo />,
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
  return (
    <div className="flex flex-col rounded-lg border border-blue-100 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-12 items-center">
          {channel.logo}
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
