import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
} from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

// Build an explicit allowlist of origins that may send credentialed requests.
// Using `origin: true` (mirror mode) is equivalent to allowing any origin
// with credentials, which enables cross-site request forgery from any page.
function buildAllowedOrigins(): string[] {
  const origins: string[] = [];

  // Explicit override from environment (highest priority)
  if (process.env.ALLOWED_ORIGINS) {
    origins.push(
      ...process.env.ALLOWED_ORIGINS.split(",")
        .map((o) => o.trim())
        .filter(Boolean),
    );
  }

  // Replit workspace domains are always present in the Replit environment
  if (process.env.REPLIT_DOMAINS) {
    for (const d of process.env.REPLIT_DOMAINS.split(",").map((d) => d.trim()).filter(Boolean)) {
      origins.push(`https://${d}`);
    }
  }

  if (process.env.REPLIT_DEV_DOMAIN) {
    origins.push(`https://${process.env.REPLIT_DEV_DOMAIN}`);
  }

  return origins;
}

const allowedOrigins = buildAllowedOrigins();

app.use(
  cors({
    origin: (origin, callback) => {
      // No Origin header → same-origin request or server-to-server (curl, webhooks) — allow.
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      // In non-production environments, also allow localhost (any port).
      if (
        process.env.NODE_ENV !== "production" &&
        /^https?:\/\/localhost(:\d+)?$/.test(origin)
      ) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  }),
);

app.use("/api/giving/stripe/webhook", express.raw({ type: "application/json" }));
app.use("/api/giving/square/webhook", express.raw({ type: "application/json" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

if (process.env.CLERK_SECRET_KEY) {
  app.use(
    clerkMiddleware({
      publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
    }),
  );
} else if (process.env.NODE_ENV !== "production") {
  logger.warn("CLERK_SECRET_KEY is not set; Clerk auth is disabled for local demo development.");
} else {
  throw new Error("CLERK_SECRET_KEY is required in production.");
}

app.use("/api", router);

export default app;
