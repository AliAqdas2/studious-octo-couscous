import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import express, { type Express } from "express";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, "public");

function buildRuntimeConfigScript(): string {
  const config: Record<string, string> = {};

  if (process.env.GOOGLE_API_KEY) {
    config.GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
  }
  if (process.env.GOOGLE_MAP_ID) {
    config.GOOGLE_MAP_ID = process.env.GOOGLE_MAP_ID;
  }

  const assignments = Object.entries(config)
    .map(([key, value]) => `window.__${key}__ = ${JSON.stringify(value)};`)
    .join("\n");

  return `<script>${assignments}</script>`;
}

export function serveStatic(app: Express): void {
  const indexPath = path.resolve(distPath, "index.html");
  const template = fs.readFileSync(indexPath, "utf-8");
  const runtimeScript = buildRuntimeConfigScript();
  const indexHtml = template.replace("</head>", `${runtimeScript}</head>`);

  app.use(express.static(distPath));

  app.use("*", (req, res, next) => {
    const url = req.originalUrl;

    if (url.startsWith("/.well-known/") || url.startsWith("/api/") || url.startsWith("/videos/") || url.startsWith("/venueimages/")) {
      return next();
    }

    res.status(200).set({ "Content-Type": "text/html" }).end(indexHtml);
  });
}
