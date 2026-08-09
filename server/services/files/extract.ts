import * as XLSX from "xlsx";
import { AppError } from "../../lib/errors.js";
import { getAiProvider, isAiConfigured } from "../ai/client.js";
import type { JsonSchemaObject } from "../ai/types.js";
import {
  isLocalFileUrl,
  parseFileIdFromUrl,
  readFileBuffer,
} from "./storage.js";

export interface ExtractResult {
  status: "success" | "error";
  output?: unknown;
  details?: string;
}

function parseSpreadsheet(buffer: Buffer): Record<string, unknown>[] {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });
  return rows.filter((row) =>
    Object.values(row).some((v) => String(v ?? "").trim() !== "")
  );
}

function normalizeKey(key: string): string {
  return String(key || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function heuristicMapRows(
  rows: Record<string, unknown>[],
  schema: Record<string, unknown>
): unknown {
  const isArray = schema.type === "array";
  const itemProps =
    (isArray
      ? (schema.items as { properties?: Record<string, unknown> })?.properties
      : (schema.properties as Record<string, unknown> | undefined)) || {};
  const propKeys = Object.keys(itemProps);

  const mapped = rows.map((row) => {
    const out: Record<string, unknown> = {};
    const rowNorm = new Map<string, unknown>();
    for (const [k, v] of Object.entries(row)) {
      rowNorm.set(normalizeKey(k), v);
    }
    for (const key of propKeys) {
      const nk = normalizeKey(key);
      if (rowNorm.has(nk)) {
        out[key] = rowNorm.get(nk);
        continue;
      }
      // common aliases
      const aliases: Record<string, string[]> = {
        name: ["full_name", "contact_name", "client_name"],
        email: ["e_mail", "email_address"],
        phone: ["phone_number", "mobile", "tel"],
        company: ["organization", "org", "business"],
      };
      const alts = aliases[nk] || [];
      for (const alt of alts) {
        if (rowNorm.has(alt)) {
          out[key] = rowNorm.get(alt);
          break;
        }
      }
    }
    return out;
  });

  if (isArray) return mapped;
  return mapped[0] ?? {};
}

function wrapSchemaForLlm(schema: Record<string, unknown>): JsonSchemaObject {
  if (schema.type === "object" && schema.properties) {
    return {
      type: "object",
      properties: schema.properties as Record<string, unknown>,
      required: Array.isArray(schema.required)
        ? (schema.required as string[])
        : undefined,
    };
  }
  // array or anything else → wrap
  return {
    type: "object",
    properties: {
      items: schema,
    },
    required: ["items"],
  };
}

export async function extractDataFromUploadedFile(params: {
  fileUrl: string;
  jsonSchema: Record<string, unknown>;
}): Promise<ExtractResult> {
  try {
    if (!isLocalFileUrl(params.fileUrl)) {
      return {
        status: "error",
        details: "Only locally uploaded files can be extracted",
      };
    }
    const id = parseFileIdFromUrl(params.fileUrl);
    if (!id) {
      return { status: "error", details: "Invalid file_url" };
    }

    const { buffer, originalName } = await readFileBuffer(id);
    const lower = originalName.toLowerCase();
    const isSheet =
      lower.endsWith(".csv") ||
      lower.endsWith(".xlsx") ||
      lower.endsWith(".xls") ||
      lower.endsWith(".tsv");

    if (!isSheet) {
      return {
        status: "error",
        details: "Unsupported file type. Upload CSV or Excel (.xlsx/.xls).",
      };
    }

    const rows = parseSpreadsheet(buffer);
    if (rows.length === 0) {
      return { status: "error", details: "No data rows found in file" };
    }

    const schema = params.jsonSchema || { type: "array" };
    const sample = rows.slice(0, 80);

    if (isAiConfigured()) {
      try {
        const ai = getAiProvider();
        const wrapped = wrapSchemaForLlm(schema);
        const completion = await ai.structuredComplete<Record<string, unknown>>(
          {
            system:
              "You map spreadsheet rows into the exact JSON schema provided. Use only values present in the rows. Omit empty fields. Return structured data only.",
            user: `Map these spreadsheet rows into the target schema.\n\nRows (JSON):\n${JSON.stringify(sample).slice(0, 60000)}`,
            jsonSchema: wrapped,
            schemaName: "extract_uploaded_file",
            temperature: 0,
            maxTokens: 8192,
          }
        );

        const data = completion.data;
        if (schema.type === "array") {
          const items =
            data &&
            typeof data === "object" &&
            "items" in data &&
            Array.isArray((data as { items?: unknown }).items)
              ? (data as { items: unknown[] }).items
              : Array.isArray(data)
                ? data
                : null;
          if (items) {
            return { status: "success", output: items };
          }
        } else if (data && typeof data === "object" && !("items" in data)) {
          return { status: "success", output: data };
        } else if (
          data &&
          typeof data === "object" &&
          "items" in data &&
          !Array.isArray((data as { items?: unknown }).items)
        ) {
          return {
            status: "success",
            output: (data as { items: unknown }).items,
          };
        }
      } catch (err) {
        console.warn(
          "[files/extract] LLM map failed, falling back to heuristic:",
          err instanceof Error ? err.message : err
        );
      }
    }

    const heuristic = heuristicMapRows(rows, schema);
    return { status: "success", output: heuristic };
  } catch (err) {
    if (err instanceof AppError) {
      return { status: "error", details: err.message };
    }
    return {
      status: "error",
      details: err instanceof Error ? err.message : String(err),
    };
  }
}
