/**
 * Render BEO HTML to a US Letter PDF via Playwright Chromium.
 */
import fs from "fs";
import path from "path";
import { chromium, type Browser } from "playwright";
import {
  embedLocalBeoImagesAsDataUrls,
  fileToDataUrl,
  wrapBeoHtmlForPrint,
} from "./beoPrintHtml.js";

const ROOT = process.cwd();

let browserPromise: Promise<Browser> | null = null;

function resolveLogoPath(): string | null {
  const candidates = [
    path.join(ROOT, "client/public/mangiadc-logo.png"),
    path.join(ROOT, "dist/public/mangiadc-logo.png"),
    path.join(ROOT, "public/mangiadc-logo.png"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
  }
  try {
    const browser = await browserPromise;
    if (!browser.isConnected()) {
      browserPromise = null;
      return getBrowser();
    }
    return browser;
  } catch (err) {
    browserPromise = null;
    throw err;
  }
}

export interface BuildBeoPdfOptions {
  eventName?: string;
  title?: string;
  /** Public HTTP origin fallback if logo file is missing from disk */
  origin?: string;
}

/**
 * @returns PDF bytes (US Letter)
 */
export async function buildBeoPdfBuffer(
  sheetHtml: string,
  opts: BuildBeoPdfOptions = {}
): Promise<Buffer> {
  const eventName = opts.eventName || "Banquet Event Order";
  const logoPath = resolveLogoPath();
  const logoDataUrl = logoPath ? fileToDataUrl(logoPath) : null;
  const venueDir = path.join(ROOT, "venueimages");

  let html = String(sheetHtml || "");
  // Embed local assets as data URLs — file:// does not load under setContent.
  html = embedLocalBeoImagesAsDataUrls(html, {
    logoDataUrl,
    venueImagesDir: fs.existsSync(venueDir) ? venueDir : undefined,
  });

  const logoSrc =
    logoDataUrl ||
    (opts.origin
      ? `${opts.origin.replace(/\/$/, "")}/mangiadc-logo.png`
      : "/mangiadc-logo.png");

  const documentHtml = wrapBeoHtmlForPrint(html, {
    title: opts.title || `BEO — ${eventName}`,
    eventTitle: eventName,
    logoSrc,
  });

  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(documentHtml, {
      waitUntil: "load",
      timeout: 60_000,
    });
    await page.emulateMedia({ media: "print" });
    // Wait for data-URL / remote images to decode
    await page
      .waitForFunction(
        () => {
          const imgs = Array.from(document.images);
          if (!imgs.length) return true;
          return imgs.every((img) => img.complete && img.naturalWidth > 0);
        },
        { timeout: 15_000 }
      )
      .catch(() => undefined);

    const pdf = await page.pdf({
      format: "Letter",
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: "0.4in",
        right: "0.5in",
        bottom: "0.6in",
        left: "0.5in",
      },
    });
    return Buffer.from(pdf);
  } finally {
    await page.close().catch(() => undefined);
  }
}
