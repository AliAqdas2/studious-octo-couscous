#!/usr/bin/env python3
"""Convert a PDF to DOCX via pdf2docx (BEO Word export)."""

from __future__ import annotations

import sys


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

    cv = Converter(pdf_path)
    try:
        cv.convert(docx_path)
    finally:
        cv.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
