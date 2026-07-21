import { PublicLayout } from "@/components/PublicLayout";
import { Link } from "wouter";
import { Youtube, Play, ArrowRight } from "lucide-react";

const YOUTUBE_CHANNEL = import.meta.env.VITE_PUBLIC_CHURCH_YOUTUBE_URL || "https://www.youtube.com/@cjcinternational";

const RECENT_SERMONS = [
  {
    title: "Walking in the Spirit",
    speaker: "Prophet Yosef",
    series: "Life in the Spirit",
    date: "July 2025",
    youtubeUrl: YOUTUBE_CHANNEL,
    thumbnail: null,
  },
  {
    title: "The Kingdom Within You",
    speaker: "Prophet Yosef",
    series: "Kingdom Living",
    date: "June 2025",
    youtubeUrl: YOUTUBE_CHANNEL,
    thumbnail: null,
  },
  {
    title: "Faith That Moves Mountains",
    speaker: "Prophet Yosef",
    series: "Foundations of Faith",
    date: "June 2025",
    youtubeUrl: YOUTUBE_CHANNEL,
    thumbnail: null,
  },
  {
    title: "One Body, Many Nations",
    speaker: "Prophet Yosef",
    series: "One Kingdom. All Nations.",
    date: "May 2025",
    youtubeUrl: YOUTUBE_CHANNEL,
    thumbnail: null,
  },
  {
    title: "The Power of Prayer",
    speaker: "Prophet Yosef",
    series: "Prayer & Intercession",
    date: "May 2025",
    youtubeUrl: YOUTUBE_CHANNEL,
    thumbnail: null,
  },
  {
    title: "Abiding in the Vine",
    speaker: "Prophet Yosef",
    series: "Discipleship",
    date: "April 2025",
    youtubeUrl: YOUTUBE_CHANNEL,
    thumbnail: null,
  },
];

export default function SermonsPage() {
  return (
    <PublicLayout>
      {/* Header */}
      <section className="py-16 px-4 text-center" style={{ background: "#181d2e" }}>
        <p className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-4">
          Messages
        </p>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Sermons</h1>
        <p className="text-gray-400 max-w-md mx-auto text-sm leading-relaxed">
          Watch the latest messages from CJC Church and browse our sermon archive on YouTube.
        </p>
      </section>

      {/* Featured — Latest Sermon */}
      <section className="py-12 px-4 bg-white">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center gap-2 mb-6">
            <div className="h-1 w-8 rounded" style={{ background: "#2563eb" }} />
            <h2 className="text-lg font-bold text-gray-900">Latest Message</h2>
          </div>

          <a
            href={YOUTUBE_CHANNEL}
            target="_blank"
            rel="noreferrer"
            className="group block rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl transition-all"
          >
            <div
              className="relative flex items-center justify-center"
              style={{ background: "#0f1322", minHeight: 340 }}
            >
              {/* YouTube-style thumbnail placeholder */}
              <div className="absolute inset-0 opacity-20"
                style={{
                  background: "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(37,99,235,0.5), transparent)",
                }}
              />
              <div className="relative z-10 flex flex-col items-center gap-4">
                <div
                  className="h-20 w-20 rounded-full flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform"
                  style={{ background: "#2563eb" }}
                >
                  <Play className="h-9 w-9 text-white ml-1" />
                </div>
                <p className="text-white font-semibold text-lg">Watch Latest Sermon on YouTube</p>
                <p className="text-blue-300 text-sm flex items-center gap-1">
                  <Youtube className="h-4 w-4" />
                  CJC Church
                </p>
              </div>
            </div>
            <div className="p-5 bg-white">
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">
                CJC Church · Live &amp; Archived
              </p>
              <p className="font-bold text-gray-900 text-lg">
                Watch Our Latest Message
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Every service is available on our YouTube channel. Subscribe to get notified of new messages.
              </p>
            </div>
          </a>
        </div>
      </section>

      {/* Recent Sermons Grid */}
      <section className="py-12 px-4 bg-gray-50">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <div className="h-1 w-8 rounded" style={{ background: "#2563eb" }} />
              <h2 className="text-lg font-bold text-gray-900">Recent Messages</h2>
            </div>
            <a
              href={YOUTUBE_CHANNEL}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-semibold flex items-center gap-1 hover:gap-2 transition-all"
              style={{ color: "#2563eb" }}
            >
              Full Archive <ArrowRight className="h-4 w-4" />
            </a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {RECENT_SERMONS.map((sermon) => (
              <a
                key={sermon.title}
                href={sermon.youtubeUrl}
                target="_blank"
                rel="noreferrer"
                className="group bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-md hover:border-blue-200 transition-all"
              >
                {/* Thumbnail */}
                <div
                  className="h-36 flex items-center justify-center relative"
                  style={{ background: "#181d2e" }}
                >
                  <div className="absolute inset-0 opacity-20"
                    style={{
                      background: "radial-gradient(ellipse at 50% 50%, rgba(37,99,235,0.6), transparent 70%)",
                    }}
                  />
                  <div
                    className="relative h-12 w-12 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform"
                    style={{ background: "#2563eb" }}
                  >
                    <Play className="h-5 w-5 text-white ml-0.5" />
                  </div>
                </div>

                {/* Info */}
                <div className="p-4">
                  <p className="text-xs font-semibold text-blue-600 mb-1">{sermon.series}</p>
                  <h3 className="font-bold text-gray-900 text-sm mb-1 leading-snug group-hover:text-blue-700 transition-colors">
                    {sermon.title}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {sermon.speaker} &nbsp;·&nbsp; {sermon.date}
                  </p>
                </div>
              </a>
            ))}
          </div>

          {/* YouTube CTA */}
          <div className="mt-10 text-center">
            <a
              href={YOUTUBE_CHANNEL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-7 py-3 text-white font-semibold rounded-lg hover:opacity-90 transition-opacity"
              style={{ background: "#cc0000" }}
            >
              <Youtube className="h-5 w-5" />
              View All Sermons on YouTube
            </a>
          </div>
        </div>
      </section>

      {/* Subscribe CTA */}
      <section className="py-14 px-4" style={{ background: "#181d2e" }}>
        <div className="mx-auto max-w-xl text-center">
          <Youtube className="h-10 w-10 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-3">Never Miss a Message</h2>
          <p className="text-gray-400 text-sm leading-relaxed mb-6">
            Subscribe to the CJC Church YouTube channel to get notified every time a new sermon is posted.
          </p>
          <a
            href={YOUTUBE_CHANNEL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-7 py-3 text-white font-semibold rounded-lg hover:opacity-90 transition-opacity mr-3"
            style={{ background: "#cc0000" }}
          >
            Subscribe on YouTube
          </a>
          <Link
            href="/connect"
            className="inline-flex items-center gap-2 px-7 py-3 border border-white/25 text-white font-semibold rounded-lg hover:bg-white/10 transition-colors"
          >
            Connect With Us
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
