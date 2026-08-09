import { createHash, randomUUID } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../../config/env.js";
import { AppError } from "../../lib/errors.js";

export interface SavedFile {
  id: string;
  absolutePath: string;
  contentType: string;
  originalName: string;
  fileUrl: string;
}

interface MetaFile {
  id: string;
  originalName: string;
  contentType: string;
  storedName: string;
  size: number;
  createdAt: string;
}

function storageRoot(): string {
  return path.resolve(env.storageDir());
}

export async function ensureStorageDir(): Promise<string> {
  const root = storageRoot();
  await mkdir(root, { recursive: true });
  return root;
}

function sanitizeFilename(name: string): string {
  const base = path.basename(name || "file").replace(/[^\w.\-]+/g, "_");
  return base.slice(0, 120) || "file";
}

function metaPath(id: string): string {
  return path.join(storageRoot(), `${id}.meta.json`);
}

function dataPath(id: string, storedName: string): string {
  return path.join(storageRoot(), storedName);
}

export function buildFileUrl(id: string): string {
  const appUrl = env.appUrl().replace(/\/$/, "");
  return `${appUrl}/api/files/${id}`;
}

/** Extract file id from our /api/files/:id URL (absolute or relative). */
export function parseFileIdFromUrl(fileUrl: string): string | null {
  const raw = String(fileUrl || "").trim();
  if (!raw) return null;
  const m = raw.match(/\/api\/files\/([0-9a-fA-F-]{36})(?:\?|$)/);
  if (m?.[1]) return m[1];
  if (/^[0-9a-fA-F-]{36}$/.test(raw)) return raw;
  return null;
}

export function isLocalFileUrl(fileUrl: string): boolean {
  return Boolean(parseFileIdFromUrl(fileUrl));
}

export async function saveBuffer(params: {
  buffer: Buffer;
  filename: string;
  contentType?: string;
}): Promise<SavedFile> {
  const root = await ensureStorageDir();
  const id = randomUUID();
  const originalName = sanitizeFilename(params.filename);
  const ext = path.extname(originalName);
  const storedName = `${id}${ext || ""}`;
  const absolutePath = path.join(root, storedName);
  const contentType =
    params.contentType?.trim() || guessContentType(originalName);

  await writeFile(absolutePath, params.buffer);

  const meta: MetaFile = {
    id,
    originalName,
    contentType,
    storedName,
    size: params.buffer.length,
    createdAt: new Date().toISOString(),
  };
  await writeFile(metaPath(id), JSON.stringify(meta, null, 2), "utf8");

  return {
    id,
    absolutePath,
    contentType,
    originalName,
    fileUrl: buildFileUrl(id),
  };
}

export async function resolveFile(id: string): Promise<{
  meta: MetaFile;
  absolutePath: string;
}> {
  if (!/^[0-9a-fA-F-]{36}$/.test(id)) {
    throw new AppError("Invalid file id", 400);
  }
  await ensureStorageDir();
  const metaFile = metaPath(id);
  if (!existsSync(metaFile)) {
    throw new AppError("File not found", 404);
  }
  const meta = JSON.parse(await readFile(metaFile, "utf8")) as MetaFile;
  const absolutePath = dataPath(id, meta.storedName);
  if (!existsSync(absolutePath)) {
    throw new AppError("File not found", 404);
  }
  // Path traversal guard
  const root = storageRoot();
  if (!absolutePath.startsWith(root + path.sep) && absolutePath !== root) {
    throw new AppError("Invalid file path", 400);
  }
  return { meta, absolutePath };
}

export async function readFileBuffer(id: string): Promise<{
  buffer: Buffer;
  contentType: string;
  originalName: string;
}> {
  const { meta, absolutePath } = await resolveFile(id);
  const buffer = await readFile(absolutePath);
  return {
    buffer,
    contentType: meta.contentType,
    originalName: meta.originalName,
  };
}

export function openFileStream(id: string) {
  return resolveFile(id).then(({ meta, absolutePath }) => ({
    meta,
    stream: createReadStream(absolutePath),
  }));
}

export function guessContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const map: Record<string, string> = {
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".csv": "text/csv",
    ".xlsx":
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".xls": "application/vnd.ms-excel",
    ".json": "application/json",
    ".txt": "text/plain",
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
  };
  return map[ext] || "application/octet-stream";
}

/** Stable short hash for logging only. */
export function shortHash(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex").slice(0, 12);
}
