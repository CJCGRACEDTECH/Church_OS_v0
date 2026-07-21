import { Link } from "wouter";
import { PublicLayout } from "@/components/PublicLayout";
import { MapPin, Clock, Youtube, ArrowRight } from "lucide-react";

const YOUTUBE_URL = import.meta.env.VITE_PUBLIC_CHURCH_YOUTUBE_URL || "https://www.youtube.com/@cjcinternational";

export default function HomePage() {
  return (
    <PublicLayout>
      {/* Hero */}
      <section
        className="relative min-h-[580px] md:min-h-[660px] flex items-center justify-center overflow-hidden"
        style={{ background: "#0f1322" }}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(37,99,235,0.18) 0%, rgba(15,19,34,0) 70%)",
          }}
        />
        <div className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: "url('/opengraph.jpg')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="relative z-10 text-center px-4 py-20 max-w-4xl mx-auto">
          <p className="text-blue-400 text-xs font-bold uppercase tracking-[0.2em] mb-5">
            Welcome to CJC Church
          </p>
          <h1 className="text-4xl md:text-6xl font-bold text-white leading-tight mb-4">
            Christ Jesus Centered
            <br />
            <span style={{ color: "#60a5fa" }}>Church</span>
          </h1>
          <p className="text-xl md:text-2xl text-blue-200/80 font-light mb-10 italic">
            One Kingdom. All Nations.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/connect"
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 text-white font-semibold rounded-lg transition-all text-base shadow-lg hover:opacity-90"
              style={{ background: "#2563eb" }}
            >
              I'm New Here
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href={YOUTUBE_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 border border-white/30 text-white font-semibold rounded-lg hover:bg-white/10 transition-colors text-base"
            >
              <Youtube className="h-5 w-5 text-red-400" />
              Watch Sermon
            </a>
          </div>
        </div>
      </section>

      {/* Service Times Bar */}
      <section className="py-5" style={{ background: "#2563eb" }}>
        <div className="mx-auto max-w-5xl px-4">
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-10 text-white">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 flex-shrink-0 text-blue-200" />
              <span className="text-sm font-medium">
                7403 Boston Blvd, Springfield, VA 22153
              </span>
            </div>
            <div className="hidden md:block h-5 w-px bg-white/30" />
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 flex-shrink-0 text-blue-200" />
              <span className="text-sm font-medium">
                Thu &amp; Fri 7 PM &nbsp;·&nbsp; Sat 6 PM &nbsp;·&nbsp; Sun 11 AM
              </span>
            </div>
            <div className="hidden md:block h-5 w-px bg-white/30" />
            <Link
              href="/events"
              className="text-sm font-semibold text-white underline underline-offset-4 hover:text-blue-100"
            >
              View All Events →
            </Link>
          </div>
        </div>
      </section>

      {/* Ministry Cards */}
      <section className="py-16 px-4 bg-white">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Get Connected</h2>
            <p className="text-gray-500 max-w-md mx-auto text-sm leading-relaxed">
              Wherever you are on your journey, there's a place for you at CJC Church.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                href: "/about",
                emoji: "⛪",
                title: "About Us",
                desc: "Our mission, vision, and leadership team. Discover who we are and what we believe.",
              },
              {
                href: "/sermons",
                emoji: "🎬",
                title: "Sermons",
                desc: "Watch our latest messages and browse the sermon archive on YouTube.",
              },
              {
                href: "/giving",
                emoji: "🙏",
                title: "Give",
                desc: "Support the ministry of CJC Church. Multiple giving methods available.",
              },
            ].map(({ href, emoji, title, desc }) => (
              <Link
                key={href}
                href={href}
                className="group flex flex-col p-7 bg-gray-50 rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all"
              >
                <div
                  className="h-12 w-12 rounded-xl flex items-center justify-center mb-4 text-2xl group-hover:scale-110 transition-transform"
                  style={{ background: "#eff6ff" }}
                >
                  {emoji}
                </div>
                <h3 className="font-bold text-gray-900 text-lg mb-2">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed flex-1">{desc}</p>
                <span
                  className="mt-4 text-sm font-semibold flex items-center gap-1 group-hover:gap-2 transition-all"
                  style={{ color: "#2563eb" }}
                >
                  Learn more <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Mission Strip */}
      <section className="py-16 px-4" style={{ background: "#181d2e" }}>
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-4">Our Mission</p>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-5 leading-snug">
            One Kingdom. All Nations.
          </h2>
          <p className="text-gray-400 leading-relaxed text-base mb-8 max-w-xl mx-auto">
            We are a diverse, Spirit-filled community committed to making disciples, building families,
            and advancing the Kingdom of God across every nation and culture.
          </p>
          <Link
            href="/connect"
            className="inline-flex items-center gap-2 px-8 py-3.5 text-white font-semibold rounded-lg transition-colors"
            style={{ background: "#2563eb" }}
          >
            Connect With Us
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
