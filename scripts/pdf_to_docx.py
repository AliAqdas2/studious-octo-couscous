#!/usr/bin/env python3
"""Convert a PDF to DOCX via pdf2docx (BEO Word export).

Before convert, redact the top band of page 1 so the repeating run-bar
does not appear above the masthead (pages 2+ keep the header).
"""

from __future__ import annotations

import os
import sys
import tempfile

# ~0.85in — covers logo + title run-bar under Letter margins
FIRST_PAGE_HEADER_PT = 72 * 0.85


def redact_first_page_header(pdf_path: str, out_path: str) -> None:
    import fitz  # PyMuPDF

    doc = fitz.open(pdf_path)
    try:
        if doc.page_count < 1:
            doc.save(out_path)
            return
        page = doc[0]
        # PDF coords: y grows downward from top of page
        band = fitz.Rect(0, 0, page.rect.width, FIRST_PAGE_HEADER_PT)
        page.add_redact_annot(band, fill=(1, 1, 1))
        page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_PIXELS)
        doc.save(out_path, garbage=3, deflate=True)
    finally:
        doc.close()


def main() -> int:
    if len(sys.argv) != 3:
        print(
            "Usage: pdf_to_docx.py <input.pdf> <output.docx>",
            file=sys.stderr,
        )
        return 2

    pdf_path, docx_path = sys.argv[1], sys.argv[2]

    try:
        from pdf2docx import Converter
    except ImportError:
        print(
            "pdf2docx is not installed. Run: pip3 install -r requirements-beo.txt",
            file=sys.stderr,
        )
        return 1

    fd, scrubbed_path = tempfile.mkstemp(suffix=".pdf", prefix="beo-scrub-")
    os.close(fd)
    try:
        try:
            redact_first_page_header(pdf_path, scrubbed_path)
            convert_src = scrubbed_path
        except Exception as err:  # noqa: BLE001 — fall back to original PDF
            print(
                f"Warning: first-page header redact failed ({err}); converting original PDF",
                file=sys.stderr,
            )
            convert_src = pdf_path

        cv = Converter(convert_src)
        try:
            cv.convert(docx_path)
        finally:
            cv.close()
    finally:
        try:
            os.unlink(scrubbed_path)
        except OSError:
            pass

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
