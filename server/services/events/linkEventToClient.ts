import { eq, sql } from "drizzle-orm";
import { getDb } from "../../db/index.js";
import { clients, events, leads } from "../../db/schema/index.js";
import { AppError } from "../../lib/errors.js";

function requireDb() {
  const db = getDb();
  if (!db) throw new AppError("Database is not configured", 503);
  return db;
}

/**
 * Base44 linkEventToClient — ensure event.clientId via lead, POC email match, or new Client.
 */
export async function linkEventToClient(eventId: string): Promise<{
  success: boolean;
  alreadyLinked?: boolean;
  clientId?: string;
  linkedViaLead?: boolean;
  linkedViaEmail?: boolean;
  newClientCreated?: boolean;
  reason?: string;
}> {
  if (!eventId) {
    return { success: false, reason: "No eventId" };
  }

  const db = requireDb();
  const eventRows = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);
  const event = eventRows[0];
  if (!event) {
    return { success: false, reason: "Event not found" };
  }

  if (event.clientId) {
    return {
      success: true,
      alreadyLinked: true,
      clientId: event.clientId,
    };
  }

  const leadRef = event.leadId || event.sourceLeadId;
  if (leadRef) {
    const leadRows = await db
      .select()
      .from(leads)
      .where(eq(leads.id, leadRef))
      .limit(1);
    const lead = leadRows[0];
    if (lead?.clientId) {
      await db
        .update(events)
        .set({ clientId: lead.clientId, updatedDate: new Date() })
        .where(eq(events.id, eventId));
      return {
        success: true,
        clientId: lead.clientId,
        linkedViaLead: true,
      };
    }
  }

  if (event.pocEmail) {
    const emailLower = event.pocEmail.toLowerCase();
    const matched = await db
      .select()
      .from(clients)
      .where(sql`lower(${clients.email}) = ${emailLower}`)
      .limit(1);

    if (matched[0]) {
      await db
        .update(events)
        .set({ clientId: matched[0].id, updatedDate: new Date() })
        .where(eq(events.id, eventId));
      return {
        success: true,
        clientId: matched[0].id,
        linkedViaEmail: true,
      };
    }

    const [newClient] = await db
      .insert(clients)
      .values({
        name: event.pocName || "Unknown",
        email: event.pocEmail,
        phone: event.pocPhone || "",
        clientType: "B2B",
        totalEvents: 0,
        lifetimeRevenue: 0,
      })
      .returning();

    await db
      .update(events)
      .set({ clientId: newClient.id, updatedDate: new Date() })
      .where(eq(events.id, eventId));

    return {
      success: true,
      clientId: newClient.id,
      newClientCreated: true,
    };
  }

  return { success: false, reason: "No email to link" };
}
