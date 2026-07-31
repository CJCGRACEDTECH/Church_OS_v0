import { spawn } from "node:child_process";
import process from "node:process";

const publicPort = process.env.PORT ?? "8080";
const apiPort = process.env.API_INTERNAL_PORT ?? "8081";
const apiInternalUrl = `http://127.0.0.1:${apiPort}`;
const replitDomain = (process.env.REPLIT_DOMAINS ?? "")
  .split(",")
  .map((domain) => domain.trim())
  .find(Boolean);
const appBaseUrl =
  process.env.APP_BASE_URL ||
  (replitDomain ? `https://${replitDomain}` : `http://localhost:${publicPort}`);

const sharedEnv = {
  ...process.env,
  NODE_ENV: process.env.NODE_ENV ?? "production",
  APP_BASE_URL: appBaseUrl,
  PUBLIC_SITE_URL: process.env.PUBLIC_SITE_URL ?? appBaseUrl,
  API_INTERNAL_URL: process.env.API_INTERNAL_URL ?? apiInternalUrl,
  CHURCH_OS_URL: process.env.CHURCH_OS_URL ?? apiInternalUrl,
};

const children = [
  spawn(
    process.execPath,
    ["--enable-source-maps", "artifacts/api-server/dist/index.mjs"],
    {
      stdio: "inherit",
      env: { ...sharedEnv, PORT: apiPort },
    },
  ),
  spawn(process.execPath, ["artifacts/public-site/server.mjs"], {
    stdio: "inherit",
    env: { ...sharedEnv, PORT: publicPort },
  }),
];

let stopping = false;

function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  setTimeout(() => process.exit(exitCode), 500).unref();
}

for (const child of children) {
  child.on("exit", (code, signal) => {
    if (!stopping) {
      console.error(
        `Unified service process exited (${signal ?? `code ${code ?? 1}`}).`,
      );
      stop(code ?? 1);
    }
  });
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
