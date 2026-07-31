import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const DEFAULT_CHANNEL_URL = "https://www.youtube.com/@cjcinternationalprophetyos9053";

interface YouTubeVideoItem {
  videoId: string;
  title: string;
  publishedAt: string;
  thumbnail: string;
  url: string;
}

async function fetchYouTubeVideos(
  apiKey: string,
  channelId: string,
  maxResults = 13,
): Promise<YouTubeVideoItem[]> {
  const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
  searchUrl.searchParams.set("part", "snippet");
  searchUrl.searchParams.set("channelId", channelId);
  searchUrl.searchParams.set("type", "video");
  searchUrl.searchParams.set("order", "date");
  searchUrl.searchParams.set("maxResults", String(maxResults));
  searchUrl.searchParams.set("key", apiKey);

  const response = await fetch(searchUrl.toString());
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`YouTube API error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as {
    items?: Array<{
      id: { videoId: string };
      snippet: {
        title: string;
        publishedAt: string;
        thumbnails: {
          high?: { url: string };
          medium?: { url: string };
          default?: { url: string };
        };
      };
    }>;
  };

  return (data.items ?? []).map((item) => {
    const { videoId } = item.id;
    const { title, publishedAt, thumbnails } = item.snippet;
    const thumbnail =
      thumbnails.high?.url ??
      thumbnails.medium?.url ??
      thumbnails.default?.url ??
      `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    return {
      videoId,
      title,
      publishedAt,
      thumbnail,
      url: `https://www.youtube.com/watch?v=${videoId}`,
    };
  });
}

// GET /api/youtube/videos
// Returns recent public videos from the configured YouTube channel.
// Requires YOUTUBE_API_KEY and YOUTUBE_CHANNEL_ID environment variables.
// Falls back gracefully with a YOUTUBE_NOT_CONFIGURED code if not set.
router.get("/youtube/videos", async (_req, res) => {
  const apiKey = process.env.YOUTUBE_API_KEY;
  const channelId = process.env.YOUTUBE_CHANNEL_ID;
  const channelUrl = process.env.YOUTUBE_CHANNEL_URL ?? DEFAULT_CHANNEL_URL;

  if (!apiKey || !channelId) {
    logger.info("YouTube API not configured; returning YOUTUBE_NOT_CONFIGURED");
    res.status(404).json({
      code: "YOUTUBE_NOT_CONFIGURED",
      message:
        "YouTube API key and channel ID are not configured. Set YOUTUBE_API_KEY and YOUTUBE_CHANNEL_ID environment variables.",
      channelUrl,
    });
    return;
  }

  try {
    const videos = await fetchYouTubeVideos(apiKey, channelId);
    res.json({ videos, channelUrl });
  } catch (err) {
    logger.error({ err }, "Failed to fetch YouTube videos");
    res.status(502).json({
      code: "YOUTUBE_FETCH_ERROR",
      message: "Failed to retrieve videos from YouTube. Please try again later.",
      channelUrl,
    });
  }
});

export default router;
