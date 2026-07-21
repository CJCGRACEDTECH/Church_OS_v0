import React from "react";
import { Link } from "wouter";
import { PlayCircle, Youtube } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type PublicSermon = {
  id: number;
  title: string;
  speakerName: string | null;
  seriesName: string | null;
  description: string | null;
  youtubeVideoId: string;
  thumbnailUrl: string;
  youtubeUrl: string;
  sermonDate: string;
};

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const CJC_YOUTUBE_CHANNEL = "https://www.youtube.com/@CJCChurch";

async function fetchPublicSermons(): Promise<PublicSermon[]> {
  const response = await fetch(`${basePath}/api/public/sermons`);
  if (!response.ok) return [];
  const data = await response.json().catch(() => ({ sermons: [] }));
  return Array.isArray(data.sermons) ? (data.sermons as PublicSermon[]) : [];
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function SermonCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <Skeleton className="w-full aspect-video" />
      <CardContent className="p-4 space-y-2">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-full" />
      </CardContent>
    </Card>
  );
}

function SermonCard({ sermon }: { sermon: PublicSermon }) {
  return (
    <Card className="overflow-hidden shadow-sm hover:shadow-md transition-shadow group">
      <a href={sermon.youtubeUrl} target="_blank" rel="noopener noreferrer" className="block relative">
        <img
          src={sermon.thumbnailUrl}
          alt={sermon.title}
          className="w-full aspect-video object-cover group-hover:opacity-90 transition-opacity"
        />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/25">
          <div className="bg-red-600 rounded-full p-3">
            <PlayCircle className="h-8 w-8 text-white" />
          </div>
        </div>
      </a>
      <CardHeader className="p-4 pb-2">
        {sermon.seriesName && (
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600 mb-1">{sermon.seriesName}</p>
        )}
        <CardTitle className="text-base leading-snug line-clamp-2">
          <a href={sermon.youtubeUrl} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-700 transition-colors">
            {sermon.title}
          </a>
        </CardTitle>
        <CardDescription className="text-sm">
          {sermon.speakerName && <span className="font-medium">{sermon.speakerName} · </span>}
          {formatDate(sermon.sermonDate)}
        </CardDescription>
      </CardHeader>
      {sermon.description && (
        <CardContent className="px-4 pb-4 pt-0">
          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{sermon.description}</p>
        </CardContent>
      )}
    </Card>
  );
}

export default function PublicSermonsPage() {
  const [sermons, setSermons] = React.useState<PublicSermon[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setIsLoading(true);
    fetchPublicSermons()
      .then((data) => {
        setSermons(data);
        setError(null);
      })
      .catch(() => {
        setError("Sermons could not be loaded. Please try again later.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  return (
    <main className="min-h-screen bg-[#eef0f8]">
      <header className="border-b border-white/10 bg-[#181d2e]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/sign-in" className="flex items-center gap-3">
            <img src={`${basePath}/cjc-logo.webp`} alt="CJC Church" className="h-10 w-auto" style={{ mixBlendMode: "screen" }} />
            <span className="font-semibold text-white">CJC Church</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/events" className="text-sm text-gray-300 hover:text-white transition-colors">
              Events
            </Link>
            <Link href="/connect" className="text-sm text-gray-300 hover:text-white transition-colors">
              Connect
            </Link>
            <Link href="/sign-in" className="text-sm border border-white/20 rounded-md px-4 py-1.5 text-white hover:bg-white/10 transition-colors">
              Login
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <PlayCircle className="h-5 w-5 text-indigo-600" />
              <span className="text-sm font-medium text-indigo-600 uppercase tracking-wide">Messages</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">Sermons</h1>
            <p className="mt-2 text-gray-500">Watch the latest messages from CJC Church.</p>
          </div>
          <a
            href={CJC_YOUTUBE_CHANNEL}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-2 rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
          >
            <Youtube className="h-4 w-4" />
            YouTube Channel
          </a>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-6">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => <SermonCardSkeleton key={i} />)}
          </div>
        ) : sermons.length === 0 && !error ? (
          <div className="rounded-xl border border-dashed bg-white/60 py-16 text-center">
            <PlayCircle className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="mt-4 text-lg font-medium text-gray-700">No sermons posted yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Check back soon for the latest messages.</p>
            <a
              href={CJC_YOUTUBE_CHANNEL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-red-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
            >
              <Youtube className="h-4 w-4" />
              Visit YouTube Channel
            </a>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {sermons.map((sermon) => <SermonCard key={sermon.id} sermon={sermon} />)}
          </div>
        )}

        <div className="mt-12 flex flex-col items-center gap-3 border-t pt-8 text-center text-sm text-muted-foreground">
          <p>
            Want to stay connected?{" "}
            <Link href="/connect" className="font-medium text-indigo-600 hover:underline">
              Fill out a connect card →
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
