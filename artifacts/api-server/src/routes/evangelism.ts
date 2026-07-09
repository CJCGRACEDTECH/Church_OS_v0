import crypto from "node:crypto";
import { and, count, desc, eq, ilike, or } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, outreachContactsTable, outreachEventsTable } from "@workspace/db";
import { ADMIN_PERMISSIONS } from "../lib/admin-permissions";
import { requireAdminPermission } from "../middlewares/auth";

const router: IRouter = Router();
const requireEvangelismAccess = requireAdminPermission(ADMIN_PERMISSIONS.EVENT_MANAGEMENT);

function requiredText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function dateFromValue(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return value.trim().toLowerCase();
}

function publicToken() {
  return crypto.randomBytes(18).toString("base64url");
}

function serializeEvent(event: typeof outreachEventsTable.$inferSelect, totalContacts = 0) {
  return {
    id: event.id,
    eventName: event.eventName,
    eventDate: event.eventDate.toISOString(),
    location: event.location,
    notes: event.notes,
    publicToken: event.publicToken,
    publicContactPath: `/evangelism/e/${event.publicToken}/contact`,
    evangelistQrPath: `/evangelism/e/${event.publicToken}/qr`,
    totalContacts,
    createdByUserId: event.createdByUserId,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  };
}

function serializeContact(contact: typeof outreachContactsTable.$inferSelect, event?: { id: number; eventName: string; eventDate: Date }) {
  return {
    id: contact.id,
    outreachEventId: contact.outreachEventId,
    firstName: contact.firstName,
    lastName: contact.lastName,
    name: `${contact.firstName} ${contact.lastName}`,
    phoneNumber: contact.phoneNumber,
    email: contact.email,
    notes: contact.notes,
    contactConsent: contact.contactConsent,
    submittedAt: contact.submittedAt.toISOString(),
    event: event
      ? {
          id: event.id,
          eventName: event.eventName,
          eventDate: event.eventDate.toISOString(),
        }
      : null,
  };
}

router.get("/admin/evangelism/events", requireEvangelismAccess, async (req, res): Promise<void> => {
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const filters = [
    eq(outreachEventsTable.churchId, req.localChurchId),
    ...(search
      ? [or(ilike(outreachEventsTable.eventName, `%${search}%`), ilike(outreachEventsTable.location, `%${search}%`))]
      : []),
  ];

  const events = await db
    .select()
    .from(outreachEventsTable)
    .where(and(...filters))
    .orderBy(desc(outreachEventsTable.eventDate));

  const contactCounts = events.length
    ? await db
        .select({ eventId: outreachContactsTable.outreachEventId, total: count() })
        .from(outreachContactsTable)
        .where(eq(outreachContactsTable.churchId, req.localChurchId))
        .groupBy(outreachContactsTable.outreachEventId)
    : [];
  const totals = new Map(contactCounts.map((row) => [row.eventId, Number(row.total)]));

  res.json({ events: events.map((event) => serializeEvent(event, totals.get(event.id) ?? 0)) });
});

router.post("/admin/evangelism/events", requireEvangelismAccess, async (req, res): Promise<void> => {
  const eventName = requiredText(req.body?.eventName);
  const eventDate = dateFromValue(req.body?.eventDate);
  const location = textOrNull(req.body?.location);
  const notes = textOrNull(req.body?.notes);

  if (!eventName || !eventDate) {
    res.status(400).json({ error: "Event name and event date are required." });
    return;
  }

  const [event] = await db
    .insert(outreachEventsTable)
    .values({
      churchId: req.localChurchId,
      eventName,
      eventDate,
      location,
      notes,
      publicToken: publicToken(),
      createdByUserId: req.localUserId,
    })
    .returning();

  res.status(201).json({ event: serializeEvent(event, 0) });
});

router.get("/admin/evangelism/events/:id", requireEvangelismAccess, async (req, res): Promise<void> => {
  const eventId = Number(req.params.id);
  if (!Number.isInteger(eventId)) {
    res.status(400).json({ error: "Invalid outreach event." });
    return;
  }

  const [event] = await db
    .select()
    .from(outreachEventsTable)
    .where(and(eq(outreachEventsTable.id, eventId), eq(outreachEventsTable.churchId, req.localChurchId)));

  if (!event) {
    res.status(404).json({ error: "Outreach event not found." });
    return;
  }

  const contacts = await db
    .select()
    .from(outreachContactsTable)
    .where(and(eq(outreachContactsTable.outreachEventId, event.id), eq(outreachContactsTable.churchId, req.localChurchId)))
    .orderBy(desc(outreachContactsTable.submittedAt));

  res.json({
    event: serializeEvent(event, contacts.length),
    contacts: contacts.map((contact) => serializeContact(contact)),
  });
});

router.get("/admin/evangelism/contacts", requireEvangelismAccess, async (req, res): Promise<void> => {
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const filters = [
    eq(outreachContactsTable.churchId, req.localChurchId),
    ...(search
      ? [
          or(
            ilike(outreachContactsTable.firstName, `%${search}%`),
            ilike(outreachContactsTable.lastName, `%${search}%`),
            ilike(outreachContactsTable.phoneNumber, `%${search}%`),
            ilike(outreachContactsTable.email, `%${search}%`),
          ),
        ]
      : []),
  ];

  const rows = await db
    .select({
      contact: outreachContactsTable,
      event: {
        id: outreachEventsTable.id,
        eventName: outreachEventsTable.eventName,
        eventDate: outreachEventsTable.eventDate,
      },
    })
    .from(outreachContactsTable)
    .innerJoin(outreachEventsTable, eq(outreachContactsTable.outreachEventId, outreachEventsTable.id))
    .where(and(...filters, eq(outreachEventsTable.churchId, req.localChurchId)))
    .orderBy(desc(outreachContactsTable.submittedAt));

  res.json({ contacts: rows.map((row) => serializeContact(row.contact, row.event)) });
});

router.get("/public/evangelism/events/:token", async (req, res): Promise<void> => {
  const token = requiredText(req.params.token);
  const [event] = await db.select().from(outreachEventsTable).where(eq(outreachEventsTable.publicToken, token));
  if (!event) {
    res.status(404).json({ error: "Outreach event not found." });
    return;
  }

  const [total] = await db
    .select({ total: count() })
    .from(outreachContactsTable)
    .where(eq(outreachContactsTable.outreachEventId, event.id));

  res.json({ event: serializeEvent(event, Number(total?.total ?? 0)) });
});

router.post("/public/evangelism/events/:token/contacts", async (req, res): Promise<void> => {
  const token = requiredText(req.params.token);
  const [event] = await db.select().from(outreachEventsTable).where(eq(outreachEventsTable.publicToken, token));
  if (!event) {
    res.status(404).json({ error: "Outreach event not found." });
    return;
  }

  const firstName = requiredText(req.body?.firstName);
  const lastName = requiredText(req.body?.lastName);
  const phoneNumber = requiredText(req.body?.phoneNumber);
  const email = normalizeEmail(req.body?.email);
  const notes = textOrNull(req.body?.notes);
  const contactConsent = req.body?.contactConsent === true;

  if (!firstName || !lastName || !phoneNumber || !contactConsent) {
    res.status(400).json({ error: "First name, last name, phone, and contact consent are required." });
    return;
  }

  if (email && !email.includes("@")) {
    res.status(400).json({ error: "Enter a valid email address." });
    return;
  }

  const [contact] = await db
    .insert(outreachContactsTable)
    .values({
      churchId: event.churchId,
      outreachEventId: event.id,
      firstName,
      lastName,
      phoneNumber,
      email,
      notes,
      contactConsent: "agreed",
    })
    .returning();

  res.status(201).json({ contact: serializeContact(contact), message: "Thank you for connecting with us." });
});

export default router;
