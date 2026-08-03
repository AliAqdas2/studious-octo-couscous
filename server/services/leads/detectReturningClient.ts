import { eq, sql } from "drizzle-orm";
import { getDb } from "../../db/index.js";
import { clients, events, leads } from "../../db/schema/index.js";
import { AppError } from "../../lib/errors.js";

function requireDb() {
  const db = getDb();
  if (!db) throw new AppError("Database is not configured", 503);
  return db;
}

function asContactList(value: unknown): { email?: string; [key: string]: unknown }[] {
  if (!Array.isArray(value)) return [];
  return value as { email?: string; [key: string]: unknown }[];
}

/**
 * Base44 detectReturningClient — after lead insert:
 * create Client if email is new, or link + summary if returning.
 */
export async function detectReturningClient(leadId: string): Promise<{
  success: boolean;
  skipped?: boolean;
  reason?: string;
  returning?: boolean;
  clientId?: string;
  summary?: Record<string, unknown>;
}> {
  if (!leadId) {
    return { success: false, reason: "No leadId found" };
  }

  const db = requireDb();
  const leadRows = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  const lead = leadRows[0];
  if (!lead) {
    return { success: false, reason: "Lead not found" };
  }

  if (lead.returningClientChecked) {
    return { success: true, skipped: true, reason: "Already processed" };
  }

  if (!lead.email) {
    return { success: false, reason: "No email on lead" };
  }

  const emailLower = lead.email.toLowerCase();
  const existing = await db
    .select()
    .from(clients)
    .where(sql`lower(${clients.email}) = ${emailLower}`)
    .limit(1);

  if (!existing[0]) {
    const clientType =
      lead.channel === "B2B" || lead.channel === "B2C" ? lead.channel : "B2C";

    const [newClient] = await db
      .insert(clients)
      .values({
        name: lead.name || lead.email,
        company: lead.company || "",
        email: lead.email,
        phone: lead.phone || "",
        additionalContacts: lead.additionalContacts || [],
        clientType,
        totalEvents: 0,
        lifetimeRevenue: 0,
        isReturning: false,
      })
      .returning();

    await db
      .update(leads)
      .set({
        clientId: newClient.id,
        isReturningClient: false,
        returningClientChecked: true,
        updatedDate: new Date(),
      })
      .where(eq(leads.id, leadId));

    console.log(
      `[detectReturningClient] New client ${newClient.id} for lead ${leadId}`
    );
    return { success: true, returning: false, clientId: newClient.id };
  }

  const client = existing[0];
  const clientEvents = await db
    .select()
    .from(events)
    .where(eq(events.clientId, client.id));

  const completedEvents = clientEvents.filter((e) => e.stage === "Completed");
  const lastEvent =
    completedEvents.length > 0
      ? [...completedEvents].sort((a, b) => {
          const at = a.eventDate ? new Date(a.eventDate).getTime() : 0;
          const bt = b.eventDate ? new Date(b.eventDate).getTime() : 0;
          return bt - at;
        })[0]
      : null;

  const summary = {
    total_events: client.totalEvents || 0,
    lifetime_revenue: client.lifetimeRevenue || 0,
    last_event_type: lastEvent?.eventType || "",
    last_venue: lastEvent?.venue || "",
    last_satisfaction: lastEvent?.satisfactionRating || "",
  };

  const existingExtras = asContactList(client.additionalContacts);
  const incomingExtras = asContactList(lead.additionalContacts);
  const seenEmails = new Set(
    existingExtras
      .map((c) => (c.email || "").toLowerCase().trim())
      .filter(Boolean)
  );
  const merged = [...existingExtras];
  for (const c of incomingExtras) {
    const key = (c.email || "").toLowerCase().trim();
    if (key && seenEmails.has(key)) continue;
    if (key) seenEmails.add(key);
    merged.push(c);
  }
  if (merged.length !== existingExtras.length) {
    await db
      .update(clients)
      .set({ additionalContacts: merged, updatedDate: new Date() })
      .where(eq(clients.id, client.id));
  }

  await db
    .update(leads)
    .set({
      clientId: client.id,
      isReturningClient: true,
      returningClientSummary: summary,
      returningClientChecked: true,
      updatedDate: new Date(),
    })
    .where(eq(leads.id, leadId));

  console.log(
    `[detectReturningClient] Linked returning client ${client.id} to lead ${leadId}`
  );
  return {
    success: true,
    returning: true,
    clientId: client.id,
    summary,
  };
}
