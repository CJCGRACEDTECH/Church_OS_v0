import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild, context as esbuildContext } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { rm } from "node:fs/promises";
import { spawn } from "node:child_process";

// Plugins (e.g. 'esbuild-plugin-pino') may use `require` to resolve dependencies
globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));
const isWatch = process.argv.includes("--watch");

const distDir = path.resolve(artifactDir, "dist");

const esbuildOptions = {
  entryPoints: [path.resolve(artifactDir, "src/index.ts")],
  platform: "node",
  bundle: true,
  format: "esm",
  outdir: distDir,
  outExtension: { ".js": ".mjs" },
  logLevel: "info",
  // Some packages may not be bundleable, so we externalize them, we can add more here as needed.
  // Some of the packages below may not be imported or installed, but we're adding them in case they are in the future.
  // Examples of unbundleable packages:
  // - uses native modules and loads them dynamically (e.g. sharp)
  // - use path traversal to read files (e.g. @google-cloud/secret-manager loads sibling .proto files)
  external: [
    "*.node",
    // connect-pg-simple reads a table.sql file at runtime via __dirname;
    // bundling it with esbuild breaks that path resolution, so externalize it.
    "connect-pg-simple",
    "sharp",
    "better-sqlite3",
    "sqlite3",
    "canvas",
    "bcrypt",
    "argon2",
    "fsevents",
    "re2",
    "farmhash",
    "xxhash-addon",
    "bufferutil",
    "utf-8-validate",
    "ssh2",
    "cpu-features",
    "dtrace-provider",
    "isolated-vm",
    "lightningcss",
    "pg-native",
    "oracledb",
    "mongodb-client-encryption",
    "nodemailer",
    "handlebars",
    "knex",
    "typeorm",
    "protobufjs",
    "onnxruntime-node",
    "@tensorflow/*",
    "@prisma/client",
    "@mikro-orm/*",
    "@grpc/*",
    "@swc/*",
    "@aws-sdk/*",
    "@azure/*",
    "@opentelemetry/*",
    "@google-cloud/*",
    "@google/*",
    "googleapis",
    "firebase-admin",
    "@parcel/watcher",
    "@sentry/profiling-node",
    "@tree-sitter/*",
    "aws-sdk",
    "classic-level",
    "dd-trace",
    "ffi-napi",
    "grpc",
    "hiredis",
    "kerberos",
    "leveldown",
    "miniflare",
    "mysql2",
    "newrelic",
    "odbc",
    "piscina",
    "realm",
    "ref-napi",
    "rocksdb",
    "sass-embedded",
    "sequelize",
    "serialport",
    "snappy",
    "tinypool",
    "usb",
    "workerd",
    "wrangler",
    "zeromq",
    "zeromq-prebuilt",
    "playwright",
    "puppeteer",
    "puppeteer-core",
    "electron",
  ],
  sourcemap: "linked",
  plugins: [
    // pino relies on workers to handle logging, instead of externalizing it we use a plugin to handle it
    esbuildPluginPino({ transports: ["pino-pretty"] })
  ],
  // Make sure packages that are cjs only (e.g. express) but are bundled continue to work in our esm output file
  banner: {
    js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';

globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
    `,
  },
};

async function buildOnce() {
  await rm(distDir, { recursive: true, force: true });
  await esbuild(esbuildOptions);
}

async function buildWatch() {
  await rm(distDir, { recursive: true, force: true });

  let serverProcess = null;

  function restartServer() {
    if (serverProcess) {
      serverProcess.kill("SIGTERM");
      serverProcess = null;
    }
    serverProcess = spawn(
      "node",
      ["--enable-source-maps", path.resolve(distDir, "index.mjs")],
      {
        stdio: "inherit",
        env: { ...process.env, NODE_ENV: "development" },
      }
    );
    serverProcess.on("exit", (code, signal) => {
      // Don't log on intentional SIGTERM restarts
      if (signal !== "SIGTERM" && code !== null) {
        console.error(`[api-server] process exited with code ${code}`);
      }
    });
  }

  const watchPlugin = {
    name: "watch-restarter",
    setup(build) {
      build.onEnd((result) => {
        if (result.errors.length === 0) {
          console.log("[api-server] rebuild complete — restarting server…");
          restartServer();
        } else {
          console.error("[api-server] rebuild failed — server not restarted");
        }
      });
    },
  };

  const ctx = await esbuildContext({
    ...esbuildOptions,
    plugins: [...esbuildOptions.plugins, watchPlugin],
  });

  await ctx.watch();
  console.log("[api-server] watching for file changes…");

  // Keep process alive; clean up on exit
  process.on("SIGINT", async () => {
    if (serverProcess) serverProcess.kill("SIGTERM");
    await ctx.dispose();
    process.exit(0);
  });
  process.on("SIGTERM", async () => {
    if (serverProcess) serverProcess.kill("SIGTERM");
    await ctx.dispose();
    process.exit(0);
  });
}

if (isWatch) {
  buildWatch().catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else {
  buildOnce().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
