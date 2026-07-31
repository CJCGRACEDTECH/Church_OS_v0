import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = process.env.PORT;
if (!PORT) throw new Error("PORT env var is required");

const PUBLIC_DIR = path.join(__dirname, "public");
const CHURCH_OS_DIST = path.resolve(
  __dirname,
  process.env.CHURCH_OS_DIST ?? "../church-os/dist/public",
);
const API_INTERNAL_URL = normalizeBaseUrl(
  process.env.API_INTERNAL_URL ?? "http://127.0.0.1:8081",
);
const PUBLIC_SITE_URL = normalizeBaseUrl(
  process.env.PUBLIC_SITE_URL ?? "https://www.cjcchurch.com",
);
const CHURCH_OS_URL = normalizeBaseUrl(process.env.CHURCH_OS_URL ?? API_INTERNAL_URL);
const CHURCH_OS_LOGIN_URL = process.env.CHURCH_OS_LOGIN_URL ?? "/sign-in";
const CHURCH_OS_CONNECT_URL = process.env.CHURCH_OS_CONNECT_URL ?? "/connect";
const CHURCH_OS_ACCOUNT_REQUEST_URL =
  process.env.CHURCH_OS_ACCOUNT_REQUEST_URL ?? "/request-account";
const GIVING_URL =
  process.env.GIVING_URL ?? "https://buy.stripe.com/00g3g83mveETbXW000";
const STRIPE_BUY_BUTTON_ID = process.env.STRIPE_BUY_BUTTON_ID?.trim() ?? "";
const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY?.trim() ?? "";
const INSTAGRAM_URL =
  process.env.INSTAGRAM_URL ?? "https://www.instagram.com/cjc.church/";
const FACEBOOK_URL =
  process.env.FACEBOOK_URL ?? "https://www.facebook.com/ChurchofJesusChrist703/";
const GOOGLE_BUSINESS_URL =
  process.env.GOOGLE_BUSINESS_URL ?? "https://share.google/6z0A4LpbKmShWkZbT";
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY?.trim() ?? "";
const YOUTUBE_CHANNEL_HANDLE =
  process.env.YOUTUBE_CHANNEL_HANDLE?.trim() ?? "@cjcinternationalprophetyos9053";
const YOUTUBE_UPLOADS_PLAYLIST_ID =
  process.env.YOUTUBE_UPLOADS_PLAYLIST_ID?.trim() ?? "";
const YOUTUBE_CHANNEL_URL =
  process.env.YOUTUBE_CHANNEL_URL ??
  "https://www.youtube.com/@cjcinternationalprophetyos9053";
const YOUTUBE_MAX_RESULTS = Math.min(
  Math.max(Number.parseInt(process.env.YOUTUBE_MAX_RESULTS ?? "12", 10) || 12, 1),
  24,
);
const LOGO_URL =
  "/assets/cdn.prod.website-files.com/6a04d9903c973b192832dc71/6a165063776b2bebe246b54b_Untitled%20design%20(25).png";
const YOUTUBE_CACHE_TTL_MS = 5 * 60 * 1000;
const EVENTS_CACHE_TTL_MS = 5 * 60 * 1000;
let scrapeVideosCache = null;  // { videos, channelUrl, cachedAt }
let scrapeLatestCache = null;  // { video, channelUrl, cachedAt }
let publicEventsCache = null;

const RETIRED_CONNECT_ROUTES = new Set([
  "/connect-groups.html",
  "/pages/childrens.html",
  "/pages/media.html",
  "/pages/new-here.html",
  "/pages/next-steps.html",
  "/pages/trm.html",
  "/pages/ways-to-serve.html",
  "/pages/youth.html",
]);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".json": "application/json",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif":  "image/gif",
  ".webp": "image/webp",
  ".svg":  "image/svg+xml",
  ".ico":  "image/x-icon",
  ".woff": "font/woff",
  ".woff2":"font/woff2",
  ".ttf":  "font/ttf",
  ".otf":  "font/otf",
  ".mp4":  "video/mp4",
  ".webm": "video/webm",
  ".mp3":  "audio/mpeg",
  ".pdf":  "application/pdf",
};

function normalizeBaseUrl(value) {
  return value.trim().replace(/\/+$/, "");
}

function redirect(res, location) {
  res.writeHead(302, {
    Location: location,
    "Cache-Control": "no-store",
    "Content-Type": "text/plain; charset=utf-8",
  });
  res.end(`Redirecting to ${location}`);
}

function redirectDestination(urlPath) {
  if (urlPath === "/about") {
    return "/our-leadership.html";
  }
  if (urlPath === "/watch") {
    return "/sermons.html";
  }
  if (urlPath === "/login" || urlPath === "/login.html" || urlPath === "/church-os") {
    return CHURCH_OS_LOGIN_URL;
  }
  if (urlPath === "/connect") {
    return CHURCH_OS_CONNECT_URL;
  }
  if (urlPath === "/request-account") {
    return CHURCH_OS_ACCOUNT_REQUEST_URL;
  }
  if (/^\/events\/[^/]+\.html$/.test(urlPath)) {
    return "/events";
  }
  if (
    urlPath === "/giving" ||
    urlPath === "/give-now" ||
    urlPath === "/giving.html" ||
    urlPath === "/pages/giving.html" ||
    urlPath === "/pages/give-now.html"
  ) {
    return "/give";
  }
  if (
    RETIRED_CONNECT_ROUTES.has(urlPath) ||
    /^\/(?:group-types|groups)\/[^/]+\.html$/.test(urlPath)
  ) {
    return CHURCH_OS_CONNECT_URL;
  }
  return null;
}

function sendJson(res, status, body, cacheControl = "no-store") {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": cacheControl,
    "X-Content-Type-Options": "nosniff",
  });
  res.end(JSON.stringify(body));
}

const CHURCH_OS_ROUTE_PREFIXES = [
  "/sign-in",
  "/sign-up",
  "/connect",
  "/request-account",
  "/admin",
  "/member",
  "/attendance",
  "/evangelism",
  "/unauthorized",
];

const CHURCH_OS_STATIC_PREFIXES = [
  "/church-os-assets/",
  "/logos/",
];

const CHURCH_OS_STATIC_FILES = new Set([
  "/cjc-logo.png",
  "/cjc-logo.webp",
  "/favicon.svg",
  "/logo.png",
  "/logo.svg",
]);

function isChurchOsRoute(urlPath) {
  return CHURCH_OS_ROUTE_PREFIXES.some(
    (prefix) => urlPath === prefix || urlPath.startsWith(`${prefix}/`),
  );
}

function safeResolveChurchOs(urlPath) {
  const resolved = path.resolve(CHURCH_OS_DIST, "." + urlPath);
  if (
    !resolved.startsWith(CHURCH_OS_DIST + path.sep) &&
    resolved !== CHURCH_OS_DIST
  ) {
    return null;
  }
  return resolved;
}

function serveChurchOsFile(req, res, urlPath) {
  const isStatic =
    CHURCH_OS_STATIC_FILES.has(urlPath) ||
    CHURCH_OS_STATIC_PREFIXES.some((prefix) => urlPath.startsWith(prefix));
  const filePath = isStatic
    ? safeResolveChurchOs(urlPath)
    : path.join(CHURCH_OS_DIST, "index.html");

  if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(503, {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(
      "Church OS is not built yet. Run `pnpm run build:replit` and restart.",
    );
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    "Content-Type": MIME[ext] || "application/octet-stream",
    "Cache-Control":
      ext === ".html" ? "no-cache" : "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  });
  fs.createReadStream(filePath).pipe(res);
}

function proxyToApi(req, res) {
  const target = new URL(req.url ?? "/", API_INTERNAL_URL);
  const proxy = http.request(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port,
      path: `${target.pathname}${target.search}`,
      method: req.method,
      headers: {
        ...req.headers,
        host: target.host,
        "x-forwarded-host": req.headers.host ?? "",
        "x-forwarded-proto": req.headers["x-forwarded-proto"] ?? "http",
      },
    },
    (proxyResponse) => {
      res.writeHead(proxyResponse.statusCode ?? 502, proxyResponse.headers);
      proxyResponse.pipe(res);
    },
  );

  proxy.on("error", (error) => {
    console.error("Church OS API proxy error:", error.message);
    if (!res.headersSent) {
      sendJson(res, 502, {
        error: "Church OS is temporarily unavailable.",
        code: "API_UNAVAILABLE",
      });
    } else {
      res.end();
    }
  });

  req.pipe(proxy);
}

/**
 * Scrape ytInitialData from a YouTube channel tab (no API key required).
 * Walks the JSON looking for lockupViewModel entries with LOCKUP_CONTENT_TYPE_VIDEO.
 */
async function scrapeYouTubeTab(tab, limit) {
  const handle = YOUTUBE_CHANNEL_HANDLE.startsWith("@")
    ? YOUTUBE_CHANNEL_HANDLE
    : `@${YOUTUBE_CHANNEL_HANDLE}`;
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
  if (markerIdx === -1) throw new Error("ytInitialData not found in YouTube page HTML");

  const jsonStart = markerIdx + marker.length;
  const jsonEnd = html.indexOf(";</script>", jsonStart);
  if (jsonEnd === -1) throw new Error("Could not find end of ytInitialData JSON");

  const data = JSON.parse(html.slice(jsonStart, jsonEnd));
  const videos = [];

  function walk(node) {
    if (!node || typeof node !== "object" || videos.length >= limit) return;

    if (node.lockupViewModel?.contentType === "LOCKUP_CONTENT_TYPE_VIDEO") {
      const lvm = node.lockupViewModel;
      const videoId = lvm.contentId;
      const lockupMeta = lvm.metadata?.lockupMetadataViewModel;
      const title = lockupMeta?.title?.content;

      // Extract human-readable date from metadataRows
      let date = "";
      const rows =
        lockupMeta?.metadata?.contentMetadataViewModel?.metadataRows ?? [];
      outer: for (const row of rows) {
        for (const part of row.metadataParts ?? []) {
          const text = part.text?.content ?? "";
          if (
            /\bago\b|streamed|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i.test(
              text
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
        /"isLive"\s*:\s*true|LIVE_BADGE_ID|BADGE_STYLE_TYPE_LIVE_NOW/.test(raw);

      if (videoId && title) {
        const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
        videos.push({
          videoId,
          title,
          thumbnail: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
          watchUrl,
          url: watchUrl, // backward-compat alias
          isLive,
          date,
          publishedAt: null, // not available from scraping
        });
      }
      return; // don't recurse into a video entry
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

async function getScrapedVideos(limit) {
  const now = Date.now();
  if (scrapeVideosCache && now - scrapeVideosCache.cachedAt < YOUTUBE_CACHE_TTL_MS) {
    return scrapeVideosCache;
  }
  try {
    const videos = await scrapeYouTubeTab("videos", Math.min(limit, 20));
    scrapeVideosCache = { videos, channelUrl: YOUTUBE_CHANNEL_URL, cachedAt: now };
    return scrapeVideosCache;
  } catch (err) {
    if (scrapeVideosCache) {
      console.error("YouTube /videos scrape failed, serving stale cache:", err.message);
      return scrapeVideosCache;
    }
    throw err;
  }
}

async function getScrapedLatest() {
  const now = Date.now();
  if (scrapeLatestCache && now - scrapeLatestCache.cachedAt < YOUTUBE_CACHE_TTL_MS) {
    return scrapeLatestCache;
  }
  try {
    const videos = await scrapeYouTubeTab("streams", 10);
    // Prefer a currently-live stream; fall back to most recent
    const live = videos.find((v) => v.isLive);
    const video = live ?? videos[0] ?? null;
    scrapeLatestCache = { video, channelUrl: YOUTUBE_CHANNEL_URL, cachedAt: now };
    return scrapeLatestCache;
  } catch (err) {
    if (scrapeLatestCache) {
      console.error("YouTube /streams scrape failed, serving stale cache:", err.message);
      return scrapeLatestCache;
    }
    throw err;
  }
}

function replaceAnchorHref(attributes, href) {
  if (/\bhref="[^"]*"/i.test(attributes)) {
    return attributes.replace(/\bhref="[^"]*"/i, `href="${href}"`);
  }
  return ` href="${href}"${attributes}`;
}

function sharedHeader(urlPath = "/") {
  const active = (paths) => paths.includes(urlPath) ? ' aria-current="page"' : "";
  return `
    <header class="cjc-v0-header">
      <div class="cjc-v0-header__inner">
        <a class="cjc-v0-brand" href="/" aria-label="CJC Church home">
          <img src="${LOGO_URL}" alt="CJC Church">
          <span>CJC Church</span>
        </a>
        <nav class="cjc-v0-nav" aria-label="Primary navigation">
          <a href="/"${active(["/home-v0.html", "/index.html", "/"])}>Home</a>
          <a href="/our-leadership.html"${active(["/about-v0.html", "/our-leadership.html"])}>About</a>
          <a href="/sermons.html"${active(["/watch-v0.html", "/sermons.html"])}>Watch</a>
          <a href="/events"${active(["/events-v0.html", "/events.html"])}>Events</a>
          <a href="/contact"${active(["/contact-v0.html", "/contact.html"])}>Contact</a>
        </nav>
        <div class="cjc-v0-actions">
          <a class="cjc-v0-login" href="${CHURCH_OS_LOGIN_URL}">Login</a>
          <a class="cjc-v0-give" href="/give"${active(["/give-v0.html"])}>Give</a>
        </div>
        <details class="cjc-v0-mobile">
          <summary aria-label="Open navigation"><span></span><span></span><span></span></summary>
          <nav aria-label="Mobile navigation">
            <a href="/">Home</a>
            <a href="/our-leadership.html">About</a>
            <a href="/sermons.html">Watch</a>
            <a href="/events">Events</a>
            <a href="/contact">Contact</a>
            <a class="cjc-v0-mobile__action" href="${CHURCH_OS_LOGIN_URL}">Login</a>
            <a class="cjc-v0-mobile__action cjc-v0-mobile__give" href="/give">Give</a>
          </nav>
        </details>
      </div>
    </header>`;
}

function sharedFooter() {
  return `
    <footer id="site-footer" class="cjc-site-footer">
      <div class="cjc-site-footer__main">
        <div class="cjc-site-footer__brand">
          <a class="cjc-v0-brand" href="/" aria-label="CJC Church home">
            <img src="${LOGO_URL}" alt="CJC Church">
            <span>CJC Church</span>
          </a>
          <p>Christ Jesus Centered Church<br>One Kingdom. All Nations.</p>
        </div>
        <div>
          <h2>Visit</h2>
          <address>7403 Boston Blvd<br>Springfield, VA 22153</address>
          <a href="${GOOGLE_BUSINESS_URL}" target="_blank" rel="noreferrer">View on Google</a>
        </div>
        <div>
          <h2>Weekly</h2>
          <p class="cjc-site-footer__schedule">Tue · 8:00 PM online<br>Thu · 7:00 PM<br>Fri · 7:00 PM<br>Sat · 7:00 PM<br>Sun · 11:00 AM</p>
          <a href="/events">Full service schedule</a>
        </div>
        <div>
          <h2>Follow &amp; Connect</h2>
          <a href="/contact">Contact</a>
          <div class="cjc-social-row" aria-label="CJC Church social media">
            <a href="${FACEBOOK_URL}" target="_blank" rel="noreferrer" aria-label="CJC Church on Facebook"><img src="/assets/facebook-mark.svg?v=20260730-2" alt=""></a>
            <a href="${INSTAGRAM_URL}" target="_blank" rel="noreferrer" aria-label="CJC Church on Instagram"><img src="/assets/instagram-mark.svg?v=20260730-2" alt=""></a>
            <a href="${YOUTUBE_CHANNEL_URL}" target="_blank" rel="noreferrer" aria-label="CJC Church on YouTube"><img src="/assets/youtube-mark.svg?v=20260730-2" alt=""></a>
          </div>
        </div>
      </div>
      <div class="cjc-site-footer__legal">
        <span>&copy; ${new Date().getFullYear()} Christ Jesus Centered Church</span>
        <a href="/privacy">Privacy</a>
      </div>
    </footer>`;
}

async function getPublicEvents() {
  if (
    publicEventsCache &&
    Date.now() - publicEventsCache.cachedAt < EVENTS_CACHE_TTL_MS
  ) {
    return publicEventsCache.payload;
  }

  const response = await fetch(`${CHURCH_OS_URL}/api/public/events`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error ?? `Church OS returned ${response.status}`);
  }
  const safePayload = {
    events: Array.isArray(payload.events)
      ? payload.events.map((event) => ({
          id: event.id,
          title: event.title,
          eventType: event.eventType,
          description: event.description,
          startDatetime: event.startDatetime,
          endDatetime: event.endDatetime,
          location: event.location,
          eventMode: event.eventMode,
          posterUrl: event.posterUrl,
        }))
      : [],
  };
  publicEventsCache = { payload: safePayload, cachedAt: Date.now() };
  return safePayload;
}

function replaceHomepageSection(html, startMarker, endMarker, replacement) {
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker, start + startMarker.length);
  if (start === -1 || end === -1 || end <= start) return html;
  return `${html.slice(0, start)}${replacement}${html.slice(end)}`;
}

function transformHtml(source, urlPath = "/") {
  let html = source;

  // One exported homepage contains a second complete document inside the first body.
  const firstHtmlTag = html.indexOf("<html ");
  const duplicateHtmlTag = html.indexOf("<html ", firstHtmlTag + 1);
  if (firstHtmlTag > 0 && duplicateHtmlTag > firstHtmlTag && duplicateHtmlTag < 8000) {
    html = `<!DOCTYPE html>${html.slice(duplicateHtmlTag)}`;
  }

  html = html
    .replace(
      "<!-- STRIPE_GIVING_EMBED -->",
      STRIPE_BUY_BUTTON_ID && STRIPE_PUBLISHABLE_KEY
        ? `<script async src="https://js.stripe.com/v3/buy-button.js"></script>
          <stripe-buy-button
            buy-button-id="${STRIPE_BUY_BUTTON_ID}"
            publishable-key="${STRIPE_PUBLISHABLE_KEY}">
          </stripe-buy-button>`
        : `<div class="giving-fallback">
            <a href="${GIVING_URL}" target="_blank" rel="noreferrer">Give securely</a>
          </div>`,
    )
    .replaceAll("https://www.instagram.com/church_of_jesuschrist", INSTAGRAM_URL)
    .replaceAll("https://your-zoom-link-here/", "https://us02web.zoom.us/j/4997378220")
    .replaceAll("Sat: 6:00pm", "Sat: 7:00pm")
    .replace(
      /<a href="tel:\(000\)000-0000" class="c-footer_link">\(000\) 000-0000<\/a>/g,
      "",
    )
    .replace(
      /<a href="mailto:info@l\.church" class="c-footer_link">info@l\.church<\/a>/g,
      "",
    )
    .replace(
      /<a href="http:\/\/google\.com" class="c-footer_privacy-link">Privacy Policy<\/a>/g,
      '<span class="c-footer_privacy-link">CJC Church</span>',
    )
    .replace(
      /<a\b([^>]*)>([\s\S]*?)<\/a>/gi,
      (anchor, attributes, content) => {
        const label = content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        if (/^I'm New$/i.test(label)) {
          return `<a${replaceAnchorHref(attributes, "/connect")}>Connect With Us</a>`;
        }
        if (/^(Sign Me Up|Sign Up Now|Signup Now|Join This Group)$/i.test(label)) {
          return `<a${replaceAnchorHref(attributes, "/connect")}>${content}</a>`;
        }
        return anchor;
      },
    );

  const beliefsSection = `
    <section id="what-we-believe" class="cjc-v0-beliefs" aria-labelledby="beliefs-title">
      <div class="cjc-v0-beliefs__intro">
        <div>
          <p>Our foundation</p>
          <h2 id="beliefs-title">What we believe</h2>
        </div>
        <p>Our faith is centered on Jesus Christ and grounded in the Word of God. These beliefs shape how we worship, serve, and live together.</p>
      </div>
      <div class="cjc-v0-beliefs__list">
        <article>
          <span>01</span>
          <h3>Jesus Christ</h3>
          <p>Jesus is the Son of God, our Savior and Lord, and the center of our faith, worship, and daily life.</p>
        </article>
        <article>
          <span>02</span>
          <h3>The Bible</h3>
          <p>We believe the Bible is the inspired Word of God and the trustworthy foundation for faith and life.</p>
        </article>
        <article>
          <span>03</span>
          <h3>Salvation</h3>
          <p>Salvation is God's gift of grace, received through faith in Jesus Christ, bringing forgiveness and new life.</p>
        </article>
        <article>
          <span>04</span>
          <h3>The Holy Spirit</h3>
          <p>The Holy Spirit is present and active, guiding, transforming, and empowering believers to follow Christ.</p>
        </article>
        <article>
          <span>05</span>
          <h3>Prayer</h3>
          <p>Prayer is an essential relationship with God. We seek Him, trust Him, and listen for His direction.</p>
        </article>
        <article>
          <span>06</span>
          <h3>Worship</h3>
          <p>Worship honors God through our gathered praise and through lives of obedience, gratitude, and surrender.</p>
        </article>
        <article>
          <span>07</span>
          <h3>Our Mission</h3>
          <p>We are called to share the Gospel, make disciples, love our neighbors, and serve people across every nation.</p>
        </article>
      </div>
    </section>`;

  html = html.replace(
    '<div data-w-id="005158a8-10d5-dcfc-aca4-2e7e66fb985b"',
    `${beliefsSection}<div data-w-id="005158a8-10d5-dcfc-aca4-2e7e66fb985b"`,
  );

  html = replaceHomepageSection(
    html,
    '<div class="c-section is--events">',
    '<div class="c-section is--mission">',
    `<section id="weekly" class="cjc-v0-weekly" aria-labelledby="weekly-title">
      <div class="cjc-v0-weekly__heading">
        <div>
          <p>Gather with us</p>
          <h2 id="weekly-title">This week at CJC</h2>
        </div>
        <div class="cjc-v0-weekly__actions">
          <button type="button" data-weekly-direction="-1" aria-label="Scroll services left">&#8592;</button>
          <button type="button" data-weekly-direction="1" aria-label="Scroll services right">&#8594;</button>
          <a href="/events">View Schedule</a>
        </div>
      </div>
      <div class="cjc-v0-weekly__track" data-weekly-track tabindex="0" aria-label="Weekly services">
        <article><span>Tuesday</span><h3>Prayer &amp; Bible Study</h3><p>8:00 PM</p><small>Online via Zoom</small></article>
        <article><span>Thursday</span><h3>Thursday Service</h3><p>7:00 PM</p><small>In person</small></article>
        <article><span>Friday</span><h3>Friday Service</h3><p>7:00 PM</p><small>In person</small></article>
        <article><span>Friday night</span><h3>Discipleship</h3><p>11:00 PM</p></article>
        <article><span>Saturday</span><h3>Saturday Service</h3><p>7:00 PM</p><small>In person</small></article>
        <article><span>Sunday</span><h3>Sunday Service</h3><p>11:00 AM</p><small>In person</small></article>
      </div>
      <script>
        (() => {
          const track = document.querySelector("[data-weekly-track]");
          if (!track) return;
          document.querySelectorAll("[data-weekly-direction]").forEach((button) => {
            button.addEventListener("click", () => {
              const direction = Number(button.dataset.weeklyDirection);
              track.scrollBy({ left: direction * Math.min(track.clientWidth * 0.78, 680), behavior: "smooth" });
            });
          });
        })();
      </script>
    </section>

    ${new Date() <= new Date('2026-08-17T00:00:00') ? `<section id="baptism-event" style="margin:0;padding:48px 24px 64px;background:#f7f9fc;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0">
      <style>
        .baptism-inner{max-width:1160px;margin:0 auto}
        .baptism-header{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:28px;flex-wrap:wrap}
        .baptism-header p{margin:0 0 6px;color:#4760ff;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;font-family:system-ui,sans-serif}
        .baptism-header h2{margin:0;font-size:32px;font-family:system-ui,sans-serif;color:#171c2c;line-height:1.1}
        .baptism-header time{padding:6px 14px;border-radius:20px;background:#fff;border:1px solid #dfe4ed;font-size:13px;font-weight:700;color:#687083;font-family:system-ui,sans-serif;white-space:nowrap;align-self:flex-start}
        .baptism-frame{border-radius:10px;overflow:hidden;box-shadow:0 8px 40px rgba(9,15,35,.12);border:1px solid #dfe4ed}
        .baptism-frame iframe{width:100%;height:700px;border:0;display:block}
        @media(max-width:768px){.baptism-frame iframe{height:520px}}
      </style>
      <div class="baptism-inner">
        <div class="baptism-header">
          <div>
            <p>Upcoming event</p>
            <h2>Baptism Service</h2>
          </div>
          <time datetime="2026-08-16">August 16, 2026</time>
        </div>
        <div class="baptism-frame">
          <iframe src="https://project-tau-rouge-65.vercel.app" title="Baptism Service — August 16, 2026" loading="lazy"></iframe>
        </div>
      </div>
      <script>
        (function(){
          var el=document.getElementById('baptism-event');
          if(!el)return;
          if(new Date()>new Date('2026-08-17T00:00:00'))el.remove();
        })();
      </script>
    </section>` : ''}`,
  );

  html = replaceHomepageSection(
    html,
    '<div class="w-dyn-list"><div role="list" class="c-section w-dyn-items">',
    '<div class="c-section is--homepage">',
    `<section id="watch-home" class="cjc-v0-watch-home" aria-labelledby="watch-home-title">
      <a class="cjc-v0-watch-home__media" data-home-video-link href="${YOUTUBE_CHANNEL_URL}" target="_blank" rel="noreferrer">
        <img data-home-video-image src="/assets/watch-placeholder.jpg" alt="">
        <span aria-hidden="true">▶</span>
      </a>
      <div class="cjc-v0-watch-home__copy">
        <p>Latest sermon</p>
        <h2 id="watch-home-title" data-home-video-title>Watch CJC Church</h2>
        <time data-home-video-date></time>
        <div>
          <a class="cjc-v0-watch-home__primary" data-home-video-link href="${YOUTUBE_CHANNEL_URL}" target="_blank" rel="noreferrer">Watch on YouTube</a>
          <a class="cjc-v0-watch-home__secondary" href="/sermons.html">More Sermons</a>
        </div>
      </div>
      <script>
        (() => {
          const title = document.querySelector("[data-home-video-title]");
          if (!title) return;
          function cleanTitle(raw) {
            let t = raw.replace(/#\\S+/g, '').trim();
            t = t.replace(/\\|\\|\\s*CJC\\s+Church\\s*/gi, '').trim();
            t = t.replace(/\\|\\|\\s*Apostle\\s+Yosef\\s+Yifru\\s*/gi, '').trim();
            t = t.replace(/[\\|\\s\u2013\u2014]+$/, '').trim();
            if (t.length > 72) t = t.slice(0, 69) + '\u2026';
            return t;
          }
          fetch("/api/youtube/videos", { headers: { Accept: "application/json" } })
            .then(async (response) => {
              const payload = await response.json();
              if (!response.ok) throw payload;
              return payload;
            })
            .then((payload) => {
              const latest = payload.videos?.[0];
              if (!latest) return;
              title.textContent = cleanTitle(latest.title);
              document.querySelector("[data-home-video-image]").src = latest.thumbnail;
              document.querySelectorAll("[data-home-video-link]").forEach((link) => {
                link.href = latest.url;
              });
              const date = document.querySelector("[data-home-video-date]");
              if (latest.date) {
                date.textContent = latest.date;
              } else if (latest.publishedAt) {
                date.dateTime = latest.publishedAt;
                date.textContent = new Intl.DateTimeFormat("en-US", {
                  month: "long", day: "numeric", year: "numeric"
                }).format(new Date(latest.publishedAt));
              }
            })
            .catch(() => {});
        })();
      </script>
    </section>`,
  );

  html = replaceHomepageSection(
    html,
    '<div class="c-section is--homepage">',
    '<div class="c-section is--footer-spacer">',
    `<section class="cjc-v0-community">
      <div class="cjc-v0-section-heading">
        <p>Life at CJC</p>
        <h2>A place to belong</h2>
      </div>
      <div class="cjc-v0-community-grid">
        <a href="/connect" style="--image:url('/assets/community-children.jpg')"><span>Children</span></a>
        <a href="/connect" style="--image:url('/assets/hero-photo-optimized.jpg')"><span>Youth</span></a>
        <a href="/connect" style="--image:url('/assets/community-worship.jpg')"><span>Worship</span></a>
        <a href="/connect" style="--image:url('/assets/community-serve.jpg')"><span>Serve &amp; Connect</span></a>
      </div>
    </section>`,
  );

  const cleanupStyle = [
    "<style id=\"cjc-runtime-cleanup\">",
    ".c-nav,.c-form.w-form,.c-hero_message,.c-button.is--share,.c-section.is--collection-hide{display:none!important}",
    ".cjc-v0-header{position:relative;z-index:9999;background:#181d2e;color:#fff;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}",
    ".cjc-overlay-shell .cjc-v0-header{position:absolute;inset:0 0 auto;width:100%;background:rgba(18,23,42,.72);border-bottom:1px solid rgba(255,255,255,.08);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}",
    ".cjc-v0-header *{box-sizing:border-box}",
    ".cjc-v0-header__inner{height:68px;max-width:1240px;margin:0 auto;padding:0 28px;display:flex;align-items:center;gap:26px}",
    ".cjc-v0-brand{display:flex;align-items:center;gap:10px;color:#fff!important;text-decoration:none!important;white-space:nowrap}",
    ".cjc-v0-brand img{width:40px;height:40px;object-fit:contain}",
    ".cjc-v0-brand span{font-size:17px;font-weight:700;letter-spacing:0}",
    ".cjc-v0-nav{display:flex;align-items:center;justify-content:center;gap:24px;margin-left:auto}",
    ".cjc-v0-nav a{color:#cbd1df!important;text-decoration:none!important;font-size:14px;font-weight:600;letter-spacing:0;transition:color .18s ease}",
    ".cjc-v0-nav a:hover{color:#fff!important}",
    ".cjc-v0-actions{display:flex;align-items:center;gap:18px}",
    ".cjc-v0-login,.cjc-v0-give{display:inline-flex;align-items:center;justify-content:center;min-height:38px;padding:0 18px;border-radius:6px;color:#fff!important;text-decoration:none!important;font-size:14px;font-weight:700;transition:transform .18s ease,box-shadow .18s ease}",
    ".cjc-v0-login{background:#4760ff}.cjc-v0-give{background:#c29b34;color:#171c2c!important}",
    ".cjc-v0-login:hover,.cjc-v0-give:hover{transform:translateY(-2px);box-shadow:0 9px 22px rgba(8,15,35,.22)}",
    ".cjc-v0-mobile{display:none;margin-left:auto;position:relative}",
    ".cjc-v0-mobile summary{width:40px;height:40px;display:grid;place-content:center;gap:5px;cursor:pointer;list-style:none}",
    ".cjc-v0-mobile summary::-webkit-details-marker{display:none}",
    ".cjc-v0-mobile summary span{display:block;width:22px;height:2px;background:#fff;border-radius:2px}",
    ".cjc-v0-mobile nav{position:absolute;right:0;top:48px;width:220px;padding:10px;background:#fff;border:1px solid #e3e7f0;border-radius:6px;box-shadow:0 14px 35px rgba(15,23,42,.2)}",
    ".cjc-v0-mobile nav a{display:block;padding:11px 12px;border-radius:4px;color:#20283a!important;text-decoration:none!important;font-size:14px;font-weight:600}",
    ".cjc-v0-mobile nav a:hover{background:#eef3ff}",
    ".cjc-v0-mobile nav .cjc-v0-mobile__action{margin-top:6px;background:#4760ff;color:#fff!important;text-align:center}",
    ".cjc-v0-mobile nav .cjc-v0-mobile__give{background:#c29b34;color:#171c2c!important}",
    ".cjc-v0-weekly,.cjc-v0-community{font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}",
    ".cjc-v0-weekly{padding:70px max(28px,calc((100vw - 1160px)/2));overflow:hidden;background:#fff}",
    ".cjc-v0-weekly__heading{display:flex;align-items:end;justify-content:space-between;gap:24px;margin-bottom:26px}",
    ".cjc-v0-weekly__heading p,.cjc-v0-section-heading p{margin:0;color:#4760ff;font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}",
    ".cjc-v0-weekly h2,.cjc-v0-community h2{margin:7px 0 0;font-size:34px;line-height:1.15;color:#171c2c;letter-spacing:0}",
    ".cjc-v0-weekly__actions{display:flex;align-items:center;gap:8px}",
    ".cjc-v0-weekly__actions button{width:40px;height:40px;border:1px solid #dfe4ed;border-radius:6px;background:#fff;color:#26334e;font-size:19px;cursor:pointer}",
    ".cjc-v0-weekly__actions button:hover{border-color:#4760ff;color:#334bd6;background:#f5f7ff}",
    ".cjc-v0-weekly__actions a{margin-left:6px;padding:11px 16px;border:1px solid #4760ff;border-radius:6px;color:#334bd6!important;text-decoration:none!important;font-size:14px;font-weight:700}",
    ".cjc-v0-weekly__track{display:flex;gap:14px;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;overscroll-behavior-x:contain;padding-bottom:2px}",
    ".cjc-v0-weekly__track::-webkit-scrollbar{display:none}",
    ".cjc-v0-weekly article{flex:0 0 min(330px,82vw);min-height:210px;padding:25px;border:1px solid #dfe4ed;border-radius:6px;background:#f7f9fd;scroll-snap-align:start}",
    ".cjc-v0-weekly article:nth-child(2n){background:#eef3ff}.cjc-v0-weekly article:nth-child(3n){border-top:3px solid #caa84a}",
    ".cjc-v0-weekly article span{color:#4760ff;font-size:12px;font-weight:800;text-transform:uppercase}",
    ".cjc-v0-weekly article h3{min-height:55px;margin:22px 0 16px;color:#171c2c;font-size:22px;line-height:1.25;letter-spacing:0}",
    ".cjc-v0-weekly article p{margin:0;color:#171c2c;font-size:24px;font-weight:800}",
    ".cjc-v0-weekly article small{display:block;margin-top:5px;color:#687083;font-size:13px}",
    ".cjc-v0-watch-home{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(340px,.8fr);align-items:stretch;background:#181d2e;color:#fff;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}",
    ".cjc-v0-watch-home__media{position:relative;min-height:520px;overflow:hidden;background:#0d1222}",
    ".cjc-v0-watch-home__media:after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent 65%,rgba(24,29,46,.85))}",
    ".cjc-v0-watch-home__media img{width:100%;height:100%;display:block;object-fit:cover;transition:transform .25s ease}",
    ".cjc-v0-watch-home__media:hover img{transform:scale(1.02)}",
    ".cjc-v0-watch-home__media span{position:absolute;z-index:1;left:38px;bottom:36px;width:54px;height:54px;display:grid;place-items:center;border-radius:50%;background:#4760ff;color:#fff;font-size:18px}",
    ".cjc-v0-watch-home__copy{display:flex;flex-direction:column;justify-content:center;padding:58px max(28px,calc((100vw - 1160px)/2)) 58px 46px}",
    ".cjc-v0-watch-home__copy>p{margin:0;color:#d8bd72;font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}",
    ".cjc-v0-watch-home__copy h2{margin:14px 0 10px;color:#fff;font-size:clamp(32px,4vw,50px);line-height:1.08;letter-spacing:0}",
    ".cjc-v0-watch-home__copy time{min-height:20px;color:#aeb7cc;font-size:14px}",
    ".cjc-v0-watch-home__copy>div{display:flex;flex-wrap:wrap;gap:10px;margin-top:28px}",
    ".cjc-v0-watch-home__copy a{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:0 17px;border-radius:6px;text-decoration:none!important;font-size:14px;font-weight:750}",
    ".cjc-v0-watch-home__primary{background:#4760ff;color:#fff!important}",
    ".cjc-v0-watch-home__secondary{border:1px solid #4c566f;color:#fff!important}",
    ".cjc-v0-beliefs{padding:84px max(28px,calc((100vw - 1160px)/2)) 96px;background:#f5f7fb;color:#171c2c;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}",
    ".cjc-v0-beliefs__intro{display:grid;grid-template-columns:minmax(260px,.75fr) minmax(320px,1fr);gap:56px;align-items:end;margin-bottom:44px}",
    ".cjc-v0-beliefs__intro>div>p{margin:0;color:#4760ff;font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}",
    ".cjc-v0-beliefs h2{margin:9px 0 0;color:#171c2c;font-size:clamp(38px,5vw,58px);line-height:1;letter-spacing:0}",
    ".cjc-v0-beliefs__intro>p{margin:0;color:#687083;font-size:17px;line-height:1.65}",
    ".cjc-v0-beliefs__list{border-top:1px solid #d8deea}",
    ".cjc-v0-beliefs article{display:grid;grid-template-columns:70px minmax(180px,.65fr) minmax(0,1fr);gap:24px;align-items:start;padding:26px 0;border-bottom:1px solid #d8deea}",
    ".cjc-v0-beliefs article>span{color:#c29b34;font-size:13px;font-weight:800}",
    ".cjc-v0-beliefs article h3{margin:0;color:#171c2c;font-size:20px;line-height:1.35;letter-spacing:0}",
    ".cjc-v0-beliefs article p{margin:0;color:#687083;font-size:15px;line-height:1.65}",
    ".cjc-v0-community{padding:76px 28px 90px;background:#f5f7fb}",
    ".cjc-v0-section-heading{max-width:1160px;margin:0 auto 26px}",
    ".cjc-v0-section-heading h2{margin-top:8px}",
    ".cjc-v0-community-grid{max-width:1160px;margin:0 auto;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}",
    ".cjc-v0-community-grid a{position:relative;min-height:260px;display:flex;align-items:flex-end;padding:20px;border-radius:6px;overflow:hidden;background-image:linear-gradient(180deg,transparent 35%,rgba(10,18,39,.82)),var(--image);background-size:cover;background-position:center;text-decoration:none!important}",
    ".cjc-v0-community-grid span{color:#fff;font-size:20px;font-weight:750;letter-spacing:0}",
    "@media(max-width:960px){.cjc-v0-nav,.cjc-v0-actions{display:none}.cjc-v0-mobile{display:block}.cjc-v0-header__inner{padding:0 18px}.cjc-v0-watch-home{grid-template-columns:1fr}.cjc-v0-watch-home__media{min-height:440px}.cjc-v0-watch-home__media:after{background:linear-gradient(180deg,transparent 65%,rgba(24,29,46,.72))}.cjc-v0-watch-home__copy{padding:50px 28px 60px}.cjc-v0-beliefs__intro{grid-template-columns:1fr;gap:20px}.cjc-v0-beliefs article{grid-template-columns:54px minmax(170px,.55fr) minmax(0,1fr)}.cjc-v0-community-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}",
    "@media(max-width:560px){.cjc-v0-brand span{font-size:16px}.cjc-v0-weekly{padding:48px 20px}.cjc-v0-weekly__heading{align-items:flex-start}.cjc-v0-weekly__actions button{display:none}.cjc-v0-weekly__actions a{margin:0;padding:10px 12px}.cjc-v0-weekly h2,.cjc-v0-community h2{font-size:28px}.cjc-v0-watch-home__media{min-height:300px}.cjc-v0-watch-home__media span{left:20px;bottom:20px;width:46px;height:46px}.cjc-v0-watch-home__copy{padding:38px 20px 52px}.cjc-v0-beliefs{padding:60px 20px 70px}.cjc-v0-beliefs__intro{margin-bottom:32px}.cjc-v0-beliefs article{grid-template-columns:36px 1fr;gap:8px 12px;padding:22px 0}.cjc-v0-beliefs article p{grid-column:2}.cjc-v0-community{padding:56px 20px 64px}.cjc-v0-community-grid{grid-template-columns:1fr}.cjc-v0-community-grid a{min-height:220px}}",
    "</style>",
  ].join("");

  if (html.includes("</head>")) {
    const canonicalPath =
      urlPath === "/home-v0.html" || urlPath === "/index.html" ? "/" :
      urlPath === "/about-v0.html" || urlPath === "/our-leadership.html" ? "/about" :
      urlPath === "/events-v0.html" ? "/events" :
      urlPath === "/watch-v0.html" || urlPath === "/sermons.html" ? "/watch" :
      urlPath === "/give-v0.html" ? "/give" :
      urlPath === "/contact-v0.html" ? "/contact" :
      urlPath === "/privacy-v0.html" ? "/privacy" :
      urlPath;
    const sharedHead = `
      <link rel="stylesheet" href="/site-v0.css?v=20260731-4">
      <link rel="canonical" href="${PUBLIC_SITE_URL}${canonicalPath}">
      <meta property="og:site_name" content="CJC Church">
      <meta property="og:type" content="website">
      <meta property="og:url" content="${PUBLIC_SITE_URL}${canonicalPath}">
      <meta property="og:image" content="${PUBLIC_SITE_URL}/opengraph.jpg">
      <meta name="twitter:card" content="summary_large_image">`;
    html = html.replace("</head>", `${sharedHead}${cleanupStyle}</head>`);
  }
  const overlayShell = new Set([
    "/home-v0.html",
    "/about-v0.html",
    "/events-v0.html",
    "/watch-v0.html",
    "/give-v0.html",
    "/contact-v0.html",
  ]).has(urlPath);
  html = html.replace(
    /<body([^>]*)>/i,
    `<body$1${overlayShell ? ' class="cjc-overlay-shell"' : ""}>${sharedHeader(urlPath)}`,
  );
  return html.replace("</body>", `${sharedFooter()}</body>`);
}

function safeResolve(urlSegment) {
  const resolved = path.resolve(PUBLIC_DIR, "." + urlSegment);
  if (!resolved.startsWith(PUBLIC_DIR + path.sep) && resolved !== PUBLIC_DIR) {
    return null;
  }
  return resolved;
}

const server = http.createServer((req, res) => {
  let urlPath = (req.url ?? "/").split("?")[0];

  if (urlPath === "/api/youtube/latest") {
    getScrapedLatest()
      .then((payload) => sendJson(res, 200, payload, "public, max-age=300"))
      .catch((err) => {
        console.error("YouTube /latest scrape failed:", err.message);
        sendJson(res, 502, {
          error: "Latest stream is temporarily unavailable.",
          code: "YOUTUBE_UPSTREAM_ERROR",
          channelUrl: YOUTUBE_CHANNEL_URL,
          video: null,
        });
      });
    return;
  }

  if (urlPath === "/api/youtube/videos") {
    const rawLimit = new URL(req.url ?? "/", "http://localhost").searchParams.get("limit");
    const limit = Math.min(Math.max(Number.parseInt(rawLimit ?? "12", 10) || 12, 1), 20);
    getScrapedVideos(limit)
      .then((payload) => sendJson(res, 200, payload, "public, max-age=300"))
      .catch((err) => {
        console.error("YouTube /videos scrape failed:", err.message);
        sendJson(res, 502, {
          error: "Recent videos are temporarily unavailable.",
          code: "YOUTUBE_UPSTREAM_ERROR",
          channelUrl: YOUTUBE_CHANNEL_URL,
          videos: [],
        });
      });
    return;
  }

  if (urlPath === "/api/public/events") {
    getPublicEvents()
      .then((payload) => sendJson(res, 200, payload, "public, max-age=180"))
      .catch((error) => {
        console.error("Unable to load public events:", error.message);
        sendJson(res, 502, {
          error: "Upcoming events are temporarily unavailable.",
          code: "EVENTS_UPSTREAM_ERROR",
        });
      });
    return;
  }

  if (urlPath.startsWith("/api/") || urlPath.startsWith("/__clerk/")) {
    proxyToApi(req, res);
    return;
  }

  if (
    isChurchOsRoute(urlPath) ||
    CHURCH_OS_STATIC_FILES.has(urlPath) ||
    CHURCH_OS_STATIC_PREFIXES.some((prefix) => urlPath.startsWith(prefix))
  ) {
    serveChurchOsFile(req, res, urlPath);
    return;
  }

  if (urlPath === "/robots.txt") {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(`User-agent: *\nAllow: /\nSitemap: ${PUBLIC_SITE_URL}/sitemap.xml\n`);
    return;
  }

  if (urlPath === "/sitemap.xml") {
    const pages = ["", "/about", "/watch", "/events", "/give", "/contact"];
    res.writeHead(200, { "Content-Type": "application/xml; charset=utf-8" });
    res.end(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((page) => `  <url><loc>${PUBLIC_SITE_URL}${page || "/"}</loc></url>`).join("\n")}
</urlset>`);
    return;
  }

  if (urlPath === "/") {
    urlPath = "/home-v0.html";
  } else if (urlPath === "/index.html") {
    redirect(res, "/");
    return;
  } else if (urlPath === "/our-leadership.html" || urlPath === "/about-v0.html") {
    urlPath = "/about-v0.html";
  } else if (urlPath === "/give") {
    urlPath = "/give-v0.html";
  } else if (urlPath === "/sermons.html") {
    urlPath = "/watch-v0.html";
  } else if (urlPath === "/events" || urlPath === "/events.html") {
    urlPath = "/events-v0.html";
  } else if (urlPath === "/contact" || urlPath === "/contact.html") {
    urlPath = "/contact-v0.html";
  } else if (urlPath === "/privacy") {
    urlPath = "/privacy-v0.html";
  }

  let destination = redirectDestination(urlPath);
  if (destination) {
    if (urlPath === "/connect" && req.url?.includes("?")) {
      destination += req.url.slice(req.url.indexOf("?"));
    }
    redirect(res, destination);
    return;
  }

  // Webflow exports store files with percent-encoded chars as literal filename
  // characters (e.g. the file on disk is literally "name%20(1).jpg", not "name (1).jpg").
  // Try the raw URL path first so those files resolve correctly, then fall back
  // to a fully-decoded path for any files that genuinely use spaces.
  let decoded = urlPath;
  try { decoded = decodeURIComponent(urlPath); } catch { /* keep raw */ }

  const candidates = [...new Set([urlPath, decoded])]
    .map(safeResolve)
    .filter(Boolean);

  if (candidates.length === 0) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  function tryNext(index) {
    if (index >= candidates.length) {
      const notFoundPath = path.join(PUBLIC_DIR, "404-v0.html");
      if (fs.existsSync(notFoundPath)) {
        const source = fs.readFileSync(notFoundPath, "utf8");
        res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
        res.end(transformHtml(source, "/404-v0.html"));
        return;
      }
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Page not found.");
      return;
    }
    const filePath = candidates[index];
    fs.stat(filePath, (err, stat) => {
      if (err || !stat.isFile()) {
        tryNext(index + 1);
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME[ext] || "application/octet-stream";
      const headers = {
        "Content-Type": contentType,
        "Cache-Control":
          ext === ".html" ? "no-cache" : "public, max-age=86400",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "SAMEORIGIN",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      };

      if (ext === ".html") {
        fs.readFile(filePath, "utf8", (readError, source) => {
          if (readError) {
            res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
            res.end("Unable to load this page.");
            return;
          }
          res.writeHead(200, headers);
          res.end(transformHtml(source, urlPath));
        });
        return;
      }

      res.writeHead(200, {
        ...headers,
      });
      fs.createReadStream(filePath).pipe(res);
    });
  }

  tryNext(0);
});

server.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`Static server running on port ${PORT}`);
});
