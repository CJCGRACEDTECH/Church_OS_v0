import { PublicLayout } from "@/components/PublicLayout";
import { Link } from "wouter";
import { CreditCard, WalletCards, Smartphone, Banknote, Gift, ArrowRight, Heart } from "lucide-react";

type GivingChannel = {
  name: string;
  detail: string;
  subDetail?: string;
  href?: string;
  badge?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
};

const GIVING_CHANNELS: GivingChannel[] = [
  {
    name: "Online — Stripe",
    detail: "Give securely by credit or debit card.",
    subDetail: "Recurring giving available",
    href: "https://buy.stripe.com/00g3g83mveETbXW000",
    badge: "Recurring available",
    icon: CreditCard,
    accent: "#6366f1",
  },
  {
    name: "PayPal",
    detail: "Give online with your PayPal account.",
    href: "https://www.paypal.com/paypalme/CJCPROPHETYOSEF?country.x=US&locale.x=en_US",
    icon: WalletCards,
    accent: "#003087",
  },
  {
    name: "Cash App",
    detail: "Send to $Give2CJC",
    href: "https://cash.app/$Give2CJC",
    icon: Smartphone,
    accent: "#00d632",
  },
  {
    name: "Venmo",
    detail: "Send to @give2cjc",
    href: "https://account.venmo.com/u/give2cjc",
    icon: Banknote,
    accent: "#3d95ce",
  },
  {
    name: "Zelle",
    detail: "Send via Zelle to",
    subDetail: "703-488-0789",
    icon: Gift,
    accent: "#6d2eba",
  },
];

export default function GivingPublicPage() {
  return (
    <PublicLayout>
      {/* Header */}
      <section className="py-16 px-4 text-center" style={{ background: "#181d2e" }}>
        <p className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-4">Stewardship</p>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Give</h1>
        <p className="text-gray-400 max-w-md mx-auto text-sm leading-relaxed">
          Your generosity makes it possible to advance the Kingdom of God through CJC Church.
          Thank you for your faithful support.
        </p>
      </section>

      {/* Scripture strip */}
      <section className="py-6 px-4 border-b border-gray-100 bg-white">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-gray-600 text-sm italic">
            "Each of you should give what you have decided in your heart to give, not reluctantly or
            under compulsion, for God loves a cheerful giver."
          </p>
          <p className="text-blue-600 text-xs font-semibold mt-2">2 Corinthians 9:7</p>
        </div>
      </section>

      {/* Giving Methods */}
      <section className="py-14 px-4 bg-gray-50">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center gap-2 mb-8">
            <div className="h-1 w-8 rounded" style={{ background: "#2563eb" }} />
            <h2 className="text-lg font-bold text-gray-900">Giving Methods</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {GIVING_CHANNELS.map((channel) => {
              const Icon = channel.icon;
              return (
                <div
                  key={channel.name}
                  className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-shadow flex flex-col"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className="h-11 w-11 rounded-lg flex items-center justify-center"
                      style={{ background: `${channel.accent}18`, color: channel.accent }}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    {channel.badge && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                        {channel.badge}
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-gray-900 mb-1">{channel.name}</h3>
                  <p className="text-sm text-gray-500 mb-1">{channel.detail}</p>
                  {channel.subDetail && (
                    <p className="text-sm font-semibold text-gray-700">{channel.subDetail}</p>
                  )}

                  <div className="mt-auto pt-4">
                    {channel.href ? (
                      <a
                        href={channel.href}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
                        style={{ background: "#2563eb" }}
                      >
                        Give with {channel.name.split("—")[0].trim()}
                        <ArrowRight className="h-4 w-4" />
                      </a>
                    ) : (
                      <div
                        className="w-full py-2.5 rounded-lg text-sm font-semibold text-center"
                        style={{ background: "#eff6ff", color: "#2563eb" }}
                      >
                        {channel.subDetail ?? channel.detail}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Cash / Check */}
      <section className="py-12 px-4 bg-white">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-7">
            <div className="flex items-start gap-4">
              <div
                className="h-11 w-11 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "#eff6ff", color: "#2563eb" }}
              >
                <Heart className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-1">In Person — Cash or Check</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  You're always welcome to give in person during any of our services. Offering baskets
                  are passed during each service. Checks can be made payable to <strong>CJC Church</strong>.
                </p>
                <div className="mt-3 text-xs text-gray-500 space-y-0.5">
                  <p>7403 Boston Blvd, Springfield, VA 22153</p>
                  <p>Thursday &amp; Friday 7 PM · Saturday 6 PM · Sunday 11 AM</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-14 px-4" style={{ background: "#181d2e" }}>
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Thank You for Your Generosity</h2>
          <p className="text-gray-400 text-sm leading-relaxed mb-6">
            Every gift — large or small — makes a difference. Your support fuels the mission of CJC
            Church and helps us reach more people with the Gospel.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="https://buy.stripe.com/00g3g83mveETbXW000"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 px-7 py-3 text-white font-semibold rounded-lg hover:opacity-90 transition-opacity"
              style={{ background: "#2563eb" }}
            >
              Give Online Now <ArrowRight className="h-4 w-4" />
            </a>
            <Link
              href="/connect"
              className="inline-flex items-center justify-center gap-2 px-7 py-3 border border-white/25 text-white font-semibold rounded-lg hover:bg-white/10 transition-colors"
            >
              Connect With Us
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
