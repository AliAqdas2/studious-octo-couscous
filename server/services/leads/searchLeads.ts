import { desc } from "drizzle-orm";
import { getDb } from "../../db/index.js";
import { leads } from "../../db/schema/index.js";
import { AppError } from "../../lib/errors.js";
import { toApiRecord } from "../entities/serialize.js";

const UNIFIED_STAGE_ORDER = [
  "New Inquiry",
  "Initial Outreach – Call to Schedule",
  "Outreach Initiated – Call Attempted",
  "Survey Sent",
  "No Answer – 1st Email Sent",
  "Awaiting Survey Response (24hr)",
  "No Survey Response – Follow-Up 1",
  "Awaiting Response After Follow-Up 1",
  "No Response – Follow-Up 2",
  "Awaiting Response After Follow-Up 2",
  "No Response – Final Email Sent",
  "Calendar Invite Sent",
  "Survey Completed – Calendar Invite Sent",
  "Awaiting Calendar Acceptance",
  "Invite Not Accepted",
  "Calendar Invite Resent",
  "2nd Follow-Up – Off Radar",
  "Calendar Accepted",
  "Invite Accepted – Survey Sent",
  "Program Planning Discussion",
  "After Meeting Follow-Up",
  "Deposit Requested",
  "Confirmed Sales",
  "Lost/Canceled",
];

export interface SearchLeadsInput {
  pageNumber?: number;
  pageSize?: number;
  searchQuery?: string;
  sortKey?: string;
  sortDir?: "asc" | "desc" | string;
  filterStages?: string[];
  filterChannel?: string;
  filterSource?: string;
  filterEventType?: string;
  filterAccount?: string;
  dateInquiryFrom?: string;
  dateInquiryTo?: string;
  dateInterestFrom?: string;
  dateInterestTo?: string;
}

export interface SearchLeadsResult {
  data: Record<string, unknown>[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

function requireDb() {
  const db = getDb();
  if (!db) {
    throw new AppError("Database is not configured", 503);
  }
  return db;
}

function asRecord(row: Record<string, unknown>): Record<string, unknown> {
  return toApiRecord(row);
}

function getField(lead: Record<string, unknown>, key: string): unknown {
  return lead[key];
}

export async function searchLeads(input: SearchLeadsInput): Promise<SearchLeadsResult> {
  const pageSize = Math.min(Math.max(Number(input.pageSize) || 50, 1), 5000);
  const pageNumber = Math.max(Number(input.pageNumber) || 1, 1);
  const searchQuery = (input.searchQuery ?? "").trim();
  const sortKey = input.sortKey || "created_date";
  const sortDir = input.sortDir === "asc" ? "asc" : "desc";
  const filterStages = Array.isArray(input.filterStages) ? input.filterStages : [];
  const filterChannel = input.filterChannel || "all";
  const filterSource = input.filterSource || "all";
  const filterEventType = input.filterEventType || "all";
  const filterAccount = (input.filterAccount ?? "").trim();
  const dateInquiryFrom = input.dateInquiryFrom || "";
  const dateInquiryTo = input.dateInquiryTo || "";
  const dateInterestFrom = input.dateInterestFrom || "";
  const dateInterestTo = input.dateInterestTo || "";

  const db = requireDb();
  const rows = await db
    .select()
    .from(leads)
    .orderBy(desc(leads.createdDate))
    .limit(5000);

  let list = rows.map((row) => asRecord(row as Record<string, unknown>));

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter((l) => {
      const name = String(getField(l, "name") ?? "").toLowerCase();
      const company = String(getField(l, "company") ?? "").toLowerCase();
      const email = String(getField(l, "email") ?? "").toLowerCase();
      return name.includes(q) || company.includes(q) || email.includes(q);
    });
  }

  if (filterStages.length > 0) {
    list = list.filter((l) => filterStages.includes(String(getField(l, "stage") ?? "")));
  }
  if (filterChannel !== "all") {
    list = list.filter((l) => getField(l, "channel") === filterChannel);
  }
  if (filterSource !== "all") {
    list = list.filter((l) => getField(l, "source") === filterSource);
  }
  if (filterEventType !== "all") {
    list = list.filter((l) => getField(l, "event_type_interest") === filterEventType);
  }
  if (filterAccount) {
    const acc = filterAccount.toLowerCase();
    list = list.filter((l) =>
      String(getField(l, "company") ?? "")
        .toLowerCase()
        .includes(acc)
    );
  }
  if (dateInquiryFrom) {
    const from = new Date(dateInquiryFrom).getTime();
    list = list.filter((l) => {
      const raw = getField(l, "created_date");
      return raw ? new Date(String(raw)).getTime() >= from : false;
    });
  }
  if (dateInquiryTo) {
    const to = new Date(`${dateInquiryTo}T23:59:59`).getTime();
    list = list.filter((l) => {
      const raw = getField(l, "created_date");
      return raw ? new Date(String(raw)).getTime() <= to : false;
    });
  }
  if (dateInterestFrom) {
    const from = new Date(dateInterestFrom).getTime();
    list = list.filter((l) => {
      const raw = getField(l, "preferred_date");
      return raw ? new Date(String(raw)).getTime() >= from : false;
    });
  }
  if (dateInterestTo) {
    const to = new Date(`${dateInterestTo}T23:59:59`).getTime();
    list = list.filter((l) => {
      const raw = getField(l, "preferred_date");
      return raw ? new Date(String(raw)).getTime() <= to : false;
    });
  }

  list.sort((a, b) => {
    const aUnreviewed = getField(a, "reviewed") === false ? 0 : 1;
    const bUnreviewed = getField(b, "reviewed") === false ? 0 : 1;
    if (aUnreviewed !== bUnreviewed) {
      return aUnreviewed - bUnreviewed;
    }

    if (sortKey === "created_date" || sortKey === "preferred_date") {
      const aVal = getField(a, sortKey) ? new Date(String(getField(a, sortKey))).getTime() : 0;
      const bVal = getField(b, sortKey) ? new Date(String(getField(b, sortKey))).getTime() : 0;
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    }

    if (sortKey === "headcount_estimate") {
      const aVal = Number(getField(a, "headcount_estimate") || 0);
      const bVal = Number(getField(b, "headcount_estimate") || 0);
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    }

    if (sortKey === "stage") {
      const ai = UNIFIED_STAGE_ORDER.indexOf(String(getField(a, "stage") ?? ""));
      const bi = UNIFIED_STAGE_ORDER.indexOf(String(getField(b, "stage") ?? ""));
      const aVal = ai >= 0 ? ai : 999;
      const bVal = bi >= 0 ? bi : 999;
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    }

    const aStr = String(getField(a, sortKey) ?? "").trim();
    const bStr = String(getField(b, sortKey) ?? "").trim();
    const aEmpty = aStr === "";
    const bEmpty = bStr === "";
    if (aEmpty && !bEmpty) return 1;
    if (!aEmpty && bEmpty) return -1;
    if (aEmpty && bEmpty) return 0;
    const cmp = aStr.localeCompare(bStr, undefined, {
      sensitivity: "base",
      numeric: true,
    });
    return sortDir === "asc" ? cmp : -cmp;
  });

  const totalCount = list.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(Math.max(1, pageNumber), totalPages);
  const start = (safePage - 1) * pageSize;
  const pageData = list.slice(start, start + pageSize);

  return {
    data: pageData,
    totalCount,
    totalPages,
    currentPage: safePage,
    pageSize,
  };
}
