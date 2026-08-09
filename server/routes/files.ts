import { Router } from "express";
import multer from "multer";
import { AppError } from "../lib/errors.js";
import { requireAuth } from "../middleware/auth.js";
import { extractDataFromUploadedFile } from "../services/files/extract.js";
import {
  openFileStream,
  saveBuffer,
} from "../services/files/storage.js";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

router.post(
  "/files/upload",
  requireAuth,
  upload.single("file"),
  async (req, res, next) => {
    try {
      const file = req.file;
      if (!file) {
        throw new AppError("file is required", 400);
      }
      const saved = await saveBuffer({
        buffer: file.buffer,
        filename: file.originalname || "upload.bin",
        contentType: file.mimetype,
      });
      res.json({ file_url: saved.fileUrl });
    } catch (err) {
      next(err);
    }
  }
);

/** Public by unguessable UUID — needed for <audio src> playback without JWT. */
router.get("/files/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!id) throw new AppError("id is required", 400);
    const { meta, stream } = await openFileStream(id);
    res.setHeader("Content-Type", meta.contentType || "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${meta.originalName.replace(/"/g, "")}"`
    );
    res.setHeader("Cache-Control", "private, max-age=86400");
    stream.on("error", (err) => next(err));
    stream.pipe(res);
  } catch (err) {
    next(err);
  }
});

router.post("/files/extract", requireAuth, async (req, res, next) => {
  try {
    const fileUrl = String(
      req.body?.file_url || req.body?.fileUrl || ""
    ).trim();
    const jsonSchema =
      req.body?.json_schema || req.body?.jsonSchema || null;
    if (!fileUrl) {
      throw new AppError("file_url is required", 400);
    }
    if (!jsonSchema || typeof jsonSchema !== "object") {
      throw new AppError("json_schema is required", 400);
    }
    const result = await extractDataFromUploadedFile({
      fileUrl,
      jsonSchema: jsonSchema as Record<string, unknown>,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
