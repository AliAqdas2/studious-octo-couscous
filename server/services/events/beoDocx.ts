/**
 * Build a US Letter .docx from BEO HTML via Playwright PDF + pdf2docx.
 */
import { spawn } from "child_process";
import fs from "fs";
import fsPromises from "fs/promises";
import os from "os";
import path from "path";
import { buildBeoPdfBuffer } from "./beoPdf.js";

const ROOT = process.cwd();
const PDF_TO_DOCX_SCRIPT = path.join(ROOT, "scripts/pdf_to_docx.py");

function resolvePythonBin(): string {
  const venvPy = path.join(ROOT, ".venv-beo", "bin", "python3");
  if (fs.existsSync(venvPy)) return venvPy;
  const venvPyWin = path.join(ROOT, ".venv-beo", "Scripts", "python.exe");
  if (fs.existsSync(venvPyWin)) return venvPyWin;
  return process.env.BEO_PYTHON || "python3";
}

export interface BuildBeoDocxOptions {
  eventName?: string;
  title?: string;
  /** Public origin for resolving relative image URLs when file:// is unavailable */
  origin?: string;
}

function runPdfToDocx(pdfPath: string, docxPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const python = resolvePythonBin();
    const child = spawn(python, [PDF_TO_DOCX_SCRIPT, pdfPath, docxPath], {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", (err) => {
      reject(
        new Error(
          `Failed to start Python for pdf2docx (${python}): ${err.message}. Create .venv-beo with: python3 -m venv .venv-beo && .venv-beo/bin/pip install -r requirements-beo.txt`
        )
      );
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          (stderr || `pdf_to_docx.py exited with code ${code}`).trim()
        )
      );
    });
  });
}

/**
 * @returns Node Buffer of a .docx file (US Letter print layout)
 */
export async function buildBeoDocxBuffer(
  sheetHtml: string,
  opts: BuildBeoDocxOptions = {}
): Promise<Buffer> {
  const eventName = opts.eventName || "Banquet Event Order";
  const pdfBuffer = await buildBeoPdfBuffer(sheetHtml, {
    eventName,
    title: opts.title,
    origin: opts.origin,
  });

  const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), "beo-docx-"));
  const pdfPath = path.join(tmpDir, "beo.pdf");
  const docxPath = path.join(tmpDir, "beo.docx");

  try {
    await fsPromises.writeFile(pdfPath, pdfBuffer);
    await runPdfToDocx(pdfPath, docxPath);
    return await fsPromises.readFile(docxPath);
  } finally {
    await fsPromises
      .rm(tmpDir, { recursive: true, force: true })
      .catch(() => undefined);
  }
}
