/**
 * Server-side BEO print HTML (Letter) for Playwright PDF — mirrors client beoTemplate wrap.
 */
import fs from "fs";
import path from "path";

const BEO_PRINT_CSS = `
  body { margin: 0; background: #fff; font-family: Arial, Helvetica, sans-serif; color: #111; }
  .beo-sheet { box-sizing: border-box; }
  .beo-section { margin: 0 0 16px 0; }
  .beo-section-title {
    padding: 0 0 6px 0;
    background: none;
    color: #134f5c;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 18px;
    font-weight: 700;
    letter-spacing: normal;
    text-transform: none;
    border: none;
    break-after: avoid;
    page-break-after: avoid;
  }
  .beo-section-body {
    border: none;
    padding: 0 0 2px 0;
    font-size: 12px;
    line-height: 1.5;
  }
  .beo-grid { border-collapse: collapse; }
  .beo-sheet img { max-width: 100%; height: auto; }
  .beo-keep { break-inside: avoid; page-break-inside: avoid; }
  .beo-print-frame { width: 100%; border: none; border-collapse: collapse; }
  .beo-print-frame td { padding: 0; vertical-align: top; }
  .beo-print-pad { display: none; height: 0; overflow: hidden; }
  .beo-run-bar, .beo-first-page-mask { display: none; }
  @page {
    size: letter;
    margin: 0.4in 0.5in 0.6in 0.5in;
  }
  @media print {
    html, body { height: auto !important; max-width: none !important; }
    body { margin: 0; padding: 0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .beo-sheet { border: none !important; max-width: none; padding: 0 !important; }
    .beo-sheet img { max-height: 4.2in; width: auto; object-fit: contain; }
    .beo-floor-map img { max-height: 4.2in; }
    .beo-print-pad { display: block; height: 0.15in; }
    td.beo-print-inner { padding: 0 !important; }
    td.beo-run-cell { padding: 0 !important; }
    .beo-run-bar {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 2px 0 8px 0;
      border-bottom: 1px solid #134f5c;
      margin: 0 0 10px 0;
    }
    .beo-run-bar img {
      display: block;
      height: 36px;
      width: auto;
      max-height: 36px;
      max-width: 130px;
      object-fit: contain;
    }
    .beo-run-title {
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 14px;
      font-weight: 700;
      color: #134f5c;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-width: 0;
    }
    .beo-first-page-mask {
      display: block;
      height: 58px;
      margin-top: -58px;
      background: #fff;
      position: relative;
      z-index: 5;
    }
  }
`;

function escHtml(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface WrapBeoPrintOptions {
  title?: string;
  eventTitle?: string;
  logoSrc?: string;
}

/**
 * Full HTML document for Playwright PDF (print media, US Letter).
 * Repeating thead run-bar for pages 2+; page 1 header is removed later via PyMuPDF redact.
 */
export function wrapBeoHtmlForPrint(
  beoHtml: string,
  opts: WrapBeoPrintOptions = {}
): string {
  const title = opts.title || "BEO";
  const eventTitle = opts.eventTitle || title;
  const logoSrc = opts.logoSrc || "/mangiadc-logo.png";
  const framed = `<table class="beo-print-frame">
  <thead><tr><td class="beo-run-cell">
    <div class="beo-run-bar">
      <img src="${escHtml(logoSrc)}" alt="Mangia DC" />
      <span class="beo-run-title">${escHtml(eventTitle)}</span>
    </div>
  </td></tr></thead>
  <tfoot><tr><td><div class="beo-print-pad">&nbsp;</div></td></tr></tfoot>
  <tbody><tr><td class="beo-print-inner">
    <div class="beo-first-page-mask" aria-hidden="true"></div>
    ${beoHtml || ""}
  </td></tr></tbody>
</table>`;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>${escHtml(title)}</title>
<style>${BEO_PRINT_CSS}
  html, body { height: auto; }
  body { max-width: none; margin: 0; padding: 0; }
</style></head><body>${framed}</body></html>`;
}

/**
 * Extract venue image filename from a src URL.
 * Handles relative, absolute http(s)/file://, and ?access_token=… / #hash.
 */
export function venueImageFilenameFromSrc(src: string): string | null {
  const raw = String(src || "").trim();
  if (!raw) return null;
  const pathOnly = raw.split(/[?#]/, 1)[0] || "";
  const marker = "/venueimages/";
  const idx = pathOnly.toLowerCase().lastIndexOf(marker);
  if (idx < 0) return null;
  let file = pathOnly.slice(idx + marker.length);
  try {
    file = decodeURIComponent(file);
  } catch {
    /* keep undecoded */
  }
  const safe = path.basename(file);
  return safe && safe !== "." && safe !== ".." ? safe : null;
}

/**
 * Rewrite relative asset URLs so Chromium can load them during PDF render.
 * Prefer data URLs (base64) — file:// fails under page.setContent (about:blank).
 */
export function absolutizeBeoAssetUrls(
  html: string,
  opts: {
    origin?: string;
    logoFileUrl?: string;
    venueImagesDirUrl?: string;
  }
): string {
  let out = String(html || "");
  const origin = (opts.origin || "").replace(/\/$/, "");

  if (opts.logoFileUrl) {
    out = out.replace(
      /src=(["'])\/?mangiadc-logo\.png\1/gi,
      `src=$1${opts.logoFileUrl}$1`
    );
    out = out.replace(
      /src=(["'])[^"']*\/mangiadc-logo\.png\1/gi,
      `src=$1${opts.logoFileUrl}$1`
    );
  } else if (origin) {
    out = out.replace(
      /src=(["'])\/(mangiadc-logo\.png)\1/gi,
      `src=$1${origin}/$2$1`
    );
  }

  if (opts.venueImagesDirUrl) {
    const base = opts.venueImagesDirUrl.replace(/\/$/, "");
    out = out.replace(
      /src=(["'])([^"']*\/venueimages\/[^"']+)\1/gi,
      (_m, q: string, url: string) => {
        const file = venueImageFilenameFromSrc(url);
        return file ? `src=${q}${base}/${file}${q}` : _m;
      }
    );
  } else if (origin) {
    out = out.replace(
      /src=(["'])(\/venueimages\/[^"']+)\1/gi,
      (_m, q: string, url: string) => {
        const file = venueImageFilenameFromSrc(url);
        return file
          ? `src=${q}${origin}/venueimages/${file}${q}`
          : _m;
      }
    );
  }

  return out;
}

function mimeForExt(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  if (ext === "svg") return "image/svg+xml";
  return "image/png";
}

/** Read a local image file as a data: URL for Playwright setContent. */
export function fileToDataUrl(filePath: string): string | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const buf = fs.readFileSync(filePath);
    return `data:${mimeForExt(filePath)};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * Embed /venueimages/* and mangiadc-logo.png as data URLs from disk.
 * Matches relative, absolute http(s), and file:// srcs, including ?access_token=.
 */
export function embedLocalBeoImagesAsDataUrls(
  html: string,
  opts: { logoDataUrl?: string | null; venueImagesDir?: string }
): string {
  let out = String(html || "");

  if (opts.logoDataUrl) {
    out = out.replace(
      /src=(["'])(?:file:\/\/[^"']*\/)?\/?mangiadc-logo\.png(?:\?[^"']*)?\1/gi,
      `src=$1${opts.logoDataUrl}$1`
    );
    out = out.replace(
      /src=(["'])[^"']*\/mangiadc-logo\.png(?:\?[^"']*)?\1/gi,
      `src=$1${opts.logoDataUrl}$1`
    );
  }

  const venueDir = opts.venueImagesDir;
  if (venueDir && fs.existsSync(venueDir)) {
    out = out.replace(
      /src=(["'])([^"']*\/venueimages\/[^"']+)\1/gi,
      (_m, q: string, url: string) => {
        const safe = venueImageFilenameFromSrc(url);
        if (!safe) return _m;
        const dataUrl = fileToDataUrl(path.join(venueDir, safe));
        return dataUrl ? `src=${q}${dataUrl}${q}` : _m;
      }
    );
  }

  return out;
}
