import { desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, sermonsTable } from "@workspace/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const DEFAULT_CHANNEL_HANDLE =
  process.env.YOUTUBE_CHANNEL_HANDLE?.trim() ||
  "@cjcinternationalprophetyos9053";
const DEFAULT_CHANNEL_URL =
  process.env.YOUTUBE_CHANNEL_URL ||
  "https://www.youtube.com/@cjcinternationalprophetyos9053";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface ScrapedVideo {
  videoId: string;
  title: string;
  thumbnail: string;
  watchUrl: string;
  url: string; // backward-compat alias for watchUrl
  isLive: boolean;
  date: string;
  publishedAt: null;
}

interface VideosCache {
  videos: ScrapedVideo[];
  channelUrl: string;
  cachedAt: number;
}

interface LatestCache {
  video: ScrapedVideo | null;
  channelUrl: string;
  cachedAt: number;
}

let scrapeVideosCache: VideosCache | null = null;
let scrapeLatestCache: LatestCache | null = null;

/**
 * Scrape ytInitialData from a YouTube channel tab — no API key required.
 * Walks the JSON looking for lockupViewModel entries with LOCKUP_CONTENT_TYPE_VIDEO.
 */
async function scrapeYouTubeTab(
  tab: "videos" | "streams",
  limit: number,
): Promise<ScrapedVideo[]> {
  const handle = DEFAULT_CHANNEL_HANDLE.startsWith("@")
    ? DEFAULT_CHANNEL_HANDLE
    : `@${DEFAULT_CHANNEL_HANDLE}`;
  const pageUrl = `https://www.youtube.com/${handle}/${tab}`;

  const response = await fetch(pageUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    },
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) {
    throw new Error(`YouTube returned HTTP ${response.status} for /${tab}`);
  }

  const html = await response.text();

  const marker = "var ytInitialData = ";
  const markerIdx = html.indexOf(marker);
  if (markerIdx === -1) {
    throw new Error("ytInitialData not found in YouTube page HTML");
  }

  const jsonStart = markerIdx + marker.length;
  const jsonEnd = html.indexOf(";</script>", jsonStart);
  if (jsonEnd === -1) {
    throw new Error("Could not find end of ytInitialData JSON");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = JSON.parse(html.slice(jsonStart, jsonEnd)) as Record<string, any>;
  const videos: ScrapedVideo[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function walk(node: any): void {
    if (!node || typeof node !== "object" || videos.length >= limit) return;

    if (node.lockupViewModel?.contentType === "LOCKUP_CONTENT_TYPE_VIDEO") {
      const lvm = node.lockupViewModel as Record<string, any>;
      const videoId = lvm.contentId as string | undefined;
      const lockupMeta = lvm.metadata?.lockupMetadataViewModel as
        | Record<string, any>
        | undefined;
      const title = lockupMeta?.title?.content as string | undefined;

      // Extract human-readable date from metadataRows
      let date = "";
      const rows: Array<Record<string, any>> =
        lockupMeta?.metadata?.contentMetadataViewModel?.metadataRows ?? [];
      outer: for (const row of rows) {
        for (const part of (row.metadataParts as Array<Record<string, any>>) ??
          []) {
          const text = (part.text?.content ?? "") as string;
          if (
            /\bago\b|streamed|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i.test(
              text,
            )
          ) {
            date = text;
            break outer;
          }
        }
      }

      // Detect live status from the stringified lockupViewModel
      const raw = JSON.stringify(lvm);
      const isLive =
        /"isLive"\s*:\s*true|LIVE_BADGE_ID|BADGE_STYLE_TYPE_LIVE_NOW/.test(
          raw,
        );

      if (videoId && title) {
        const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
        videos.push({
          videoId,
          title,
          thumbnail: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
          watchUrl,
          url: watchUrl,
          isLive,
          date,
          publishedAt: null,
        });
      }
      return; // don't recurse into a matched video entry
    }

    if (Array.isArray(node)) {
      for (const item of node) walk(item);
    } else {
      for (const val of Object.values(node)) walk(val);
    }
  }

  walk(data);
  return videos;
}

async function getScrapedVideos(limit: number): Promise<VideosCache> {
  const now = Date.now();
  if (scrapeVideosCache && now - scrapeVideosCache.cachedAt < CACHE_TTL_MS) {
    return scrapeVideosCache;
  }
  try {
    const videos = await scrapeYouTubeTab("videos", Math.min(limit, 20));
    scrapeVideosCache = { videos, channelUrl: DEFAULT_CHANNEL_URL, cachedAt: now };
    return scrapeVideosCache;
  } catch (err) {
    if (scrapeVideosCache) {
      logger.warn({ err }, "YouTube /videos scrape failed, serving stale cache");
      return scrapeVideosCache;
    }
    throw err;
  }
}

async function getScrapedLatest(): Promise<LatestCache> {
  const now = Date.now();
  if (scrapeLatestCache && now - scrapeLatestCache.cachedAt < CACHE_TTL_MS) {
    return scrapeLatestCache;
  }
  try {
    const videos = await scrapeYouTubeTab("streams", 10);
    const live = videos.find((v) => v.isLive);
    const video = live ?? videos[0] ?? null;
    scrapeLatestCache = { video, channelUrl: DEFAULT_CHANNEL_URL, cachedAt: now };
    return scrapeLatestCache;
  } catch (err) {
    if (scrapeLatestCache) {
      logger.warn({ err }, "YouTube /streams scrape failed, serving stale cache");
      return scrapeLatestCache;
    }
    throw err;
  }
}

async function fetchSermonsFromDb() {
  const sermons = await db
    .select()
    .from(sermonsTable)
    .where(eq(sermonsTable.isPublished, true))
    .orderBy(desc(sermonsTable.sermonDate))
    .limit(13);

  return sermons.map((sermon) => ({
    videoId: sermon.youtubeVideoId,
    title: sermon.title,
    thumbnail: `https://i.ytimg.com/vi/${sermon.youtubeVideoId}/hqdefault.jpg`,
    watchUrl: `https://www.youtube.com/watch?v=${sermon.youtubeVideoId}`,
    url: `https://www.youtube.com/watch?v=${sermon.youtubeVideoId}`,
    isLive: false,
    date: "",
    publishedAt: sermon.sermonDate.toISOString(),
    speakerName: sermon.speakerName ?? undefined,
    seriesName: sermon.seriesName ?? undefined,
    description: sermon.description ?? undefined,
  }));
}

// GET /api/youtube/latest
// Returns the most recent livestream (or currently-live stream if one is active).
// Scraped from the channel's /streams tab — no API key required.
router.get("/youtube/latest", async (_req, res) => {
  try {
    const payload = await getScrapedLatest();
    res.set("Cache-Control", "public, max-age=300");
    res.json(payload);
  } catch (err) {
    logger.error({ err }, "Failed to scrape YouTube latest stream");
    res.status(502).json({
      code: "YOUTUBE_FETCH_ERROR",
      message: "Latest stream is temporarily unavailable.",
      channelUrl: DEFAULT_CHANNEL_URL,
      video: null,
    });
  }
});

// GET /api/youtube/videos?limit=12
// Returns recent videos from the channel's /videos tab (no API key required).
// Falls back to manually-entered sermons in the database when YouTube is unreachable.
router.get("/youtube/videos", async (req, res) => {
  const rawLimit = req.query.limit;
  const limit = Math.min(
    Math.max(Number.parseInt(String(rawLimit ?? "12"), 10) || 12, 1),
    20,
  );

  try {
    const payload = await getScrapedVideos(limit);
    logger.info({ count: payload.videos.length }, "Serving YouTube videos from scrape");
    res.set("Cache-Control", "public, max-age=300");
    res.json(payload);
  } catch (scrapeErr) {
    logger.warn({ err: scrapeErr }, "YouTube scrape failed; falling back to DB sermons");
    try {
      const videos = await fetchSermonsFromDb();
      logger.info({ count: videos.length }, "Serving sermons from DB as YouTube fallback");
      res.json({ videos, channelUrl: DEFAULT_CHANNEL_URL, source: "db" });
    } catch (dbErr) {
      logger.error({ err: dbErr }, "Both YouTube scrape and DB fallback failed");
      res.status(502).json({
        code: "YOUTUBE_FETCH_ERROR",
        message:
          "Recent videos are temporarily unavailable. Visit the CJC Church YouTube channel.",
        channelUrl: DEFAULT_CHANNEL_URL,
        videos: [],
      });
    }
  }
});

export default router;
