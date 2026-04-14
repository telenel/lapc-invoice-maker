// src/domains/chat/tools.ts
import { tool } from "ai";
import { z } from "zod";
import { invoiceService } from "@/domains/invoice/service";
import { quoteService } from "@/domains/quote/service";
import { staffService } from "@/domains/staff/service";
import { contactService } from "@/domains/contact/service";
import { eventService } from "@/domains/event/service";
import { prisma } from "@/lib/prisma";
import type { ChatUser } from "./types";
import type { InvoiceFilters } from "@/domains/invoice/types";
import type { QuoteFilters } from "@/domains/quote/types";
import type { EventType, UpdateEventInput } from "@/domains/event/types";

export function buildTools(user: ChatUser) {
  return {
    listInvoices: tool({
      description:
        "List invoices with optional filters. Returns paginated results with invoice number, status, department, amount, and date.",
      inputSchema: z.object({
        search: z.string().optional().describe("Search term for invoice number or department"),
        status: z
          .enum(["DRAFT", "FINAL", "PENDING_CHARGE"])
          .optional()
          .describe("Filter by invoice status"),
        department: z.string().optional().describe("Filter by department"),
        page: z.number().optional().describe("Page number (default 1)"),
        pageSize: z.number().optional().describe("Results per page (default 10)"),
      }),
      execute: async ({ search, status, department, page, pageSize }) => {
        const filters: InvoiceFilters = {
          search,
          status,
          department,
          page: page ?? 1,
          pageSize: pageSize ?? 10,
        };
        const result = await invoiceService.list(filters);
        return {
          invoices: result.invoices.map((inv) => ({
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            status: inv.status,
            department: inv.department,
            totalAmount: inv.totalAmount,
            date: inv.date,
            staffName: inv.staff?.name ?? inv.contact?.name ?? "Unknown",
            creatorName: inv.creatorName,
          })),
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
        };
      },
    }),

    listQuotes: tool({
      description:
        "List quotes with optional status filter. Quotes are invoices with type QUOTE.",
      inputSchema: z.object({
        status: z
          .enum(["DRAFT", "SENT", "SUBMITTED_EMAIL", "SUBMITTED_MANUAL", "ACCEPTED", "DECLINED", "REVISED", "EXPIRED"])
          .optional()
          .describe("Filter by quote status"),
        search: z.string().optional().describe("Search term"),
        page: z.number().optional().describe("Page number (default 1)"),
        pageSize: z.number().optional().describe("Results per page (default 10)"),
      }),
      execute: async ({ status, search, page, pageSize }) => {
        const filters: QuoteFilters = {
          quoteStatus: status,
          search,
          page: page ?? 1,
          pageSize: pageSize ?? 10,
        };
        const result = await quoteService.list(filters);
        return {
          quotes: result.quotes.map((quote) => ({
            id: quote.id,
            quoteNumber: quote.quoteNumber,
            quoteStatus: quote.quoteStatus,
            department: quote.department,
            totalAmount: quote.totalAmount,
            date: quote.date,
            recipientName: quote.recipientName || quote.recipientOrg || "Unknown",
            creatorName: quote.creatorName,
          })),
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
        };
      },
    }),

    getInvoice: tool({
      description: "Get a single invoice or quote by its ID. Returns full details including line items.",
      inputSchema: z.object({
        id: z.string().describe("The invoice/quote ID"),
      }),
      execute: async ({ id }) => {
        const invoice = await invoiceService.getById(id);
        if (invoice) {
          return {
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            status: invoice.status,
            type: invoice.type,
            department: invoice.department,
            category: invoice.category,
            totalAmount: invoice.totalAmount,
            date: invoice.date,
            notes: invoice.notes,
            staffName: invoice.staff?.name ?? invoice.contact?.name ?? "Unknown",
            creatorId: invoice.creatorId,
            creatorName: invoice.creatorName,
            items: invoice.items.map((item) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              extendedPrice: item.extendedPrice,
            })),
          };
        }
        const quote = await quoteService.getById(id);
        if (!quote) {
          return { error: "Invoice or quote not found" };
        }
        return {
          id: quote.id,
          quoteNumber: quote.quoteNumber,
          quoteStatus: quote.quoteStatus,
          type: quote.type,
          department: quote.department,
          category: quote.category,
          totalAmount: quote.totalAmount,
          date: quote.date,
          expirationDate: quote.expirationDate,
          recipientName: quote.recipientName,
          recipientEmail: quote.recipientEmail,
          recipientOrg: quote.recipientOrg,
          notes: quote.notes,
          creatorId: quote.creatorId,
          creatorName: quote.creatorName,
          items: quote.items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            extendedPrice: item.extendedPrice,
          })),
        };
      },
    }),

    searchPeople: tool({
      description:
        "Search staff members AND external contacts by name, department, or title. Returns results from both tables, clearly labeled with type 'staff' or 'contact'. Use the returned 'id' as staffId (for staff) or contactId (for contacts) and 'department' as the department when creating invoices/quotes.",
      inputSchema: z.object({
        search: z.string().describe("Search term for name, department, or title"),
      }),
      execute: async ({ search }) => {
        const [staff, contacts] = await Promise.all([
          staffService.list({ search }),
          contactService.search(search, user.id),
        ]);
        return {
          staff: staff.slice(0, 10).map((s) => ({
            id: s.id,
            name: s.name,
            title: s.title,
            department: s.department,
            email: s.email,
            phone: s.phone,
            extension: s.extension,
            type: "staff" as const,
          })),
          contacts: contacts.slice(0, 10).map((c) => ({
            id: c.id,
            name: c.name,
            org: c.org,
            department: c.department,
            email: c.email,
            type: "contact" as const,
          })),
          total: staff.length + contacts.length,
        };
      },
    }),

    listCalendarEvents: tool({
      description: "List calendar events for a date range. Returns event title, type, date, time, and location.",
      inputSchema: z.object({
        startDate: z.string().describe("Start date in YYYY-MM-DD format"),
        endDate: z.string().describe("End date in YYYY-MM-DD format"),
      }),
      execute: async ({ startDate, endDate }) => {
        const events = await eventService.listForDateRange(
          new Date(startDate),
          new Date(endDate)
        );
        return {
          events: events.map((e) => ({
            id: e.id,
            title: e.title,
            start: e.start,
            allDay: e.allDay,
            source: e.source,
            type: e.extendedProps.type,
            location: e.extendedProps.location,
          })),
          total: events.length,
        };
      },
    }),

    createCalendarEvent: tool({
      description: "Create a new calendar event. All users can create events.",
      inputSchema: z.object({
        title: z.string().describe("Event title"),
        type: z
          .enum(["MEETING", "SEMINAR", "VENDOR", "OTHER"])
          .describe("Event type"),
        date: z.string().describe("Event date in YYYY-MM-DD format"),
        startTime: z
          .string()
          .optional()
          .describe("Start time in HH:MM format (24h)"),
        endTime: z.string().optional().describe("End time in HH:MM format (24h)"),
        allDay: z.boolean().optional().describe("Whether this is an all-day event"),
        location: z.string().optional().describe("Event location"),
        description: z.string().optional().describe("Event description"),
      }),
      execute: async ({ title, type, date, startTime, endTime, allDay, location, description }) => {
        const event = await eventService.create(
          {
            title,
            type: type as EventType,
            date,
            startTime,
            endTime,
            allDay,
            location,
            description,
          },
          user.id
        );
        return {
          id: event.id,
          title: event.title,
          date: event.date,
          type: event.type,
          message: `Event "${event.title}" created for ${event.date}.`,
        };
      },
    }),

    getAnalytics: tool({
      description:
        "Get dashboard analytics including invoice counts by category, department, month, and user.",
      inputSchema: z.object({
        dateFrom: z
          .string()
          .optional()
          .describe("Start date filter in YYYY-MM-DD format"),
        dateTo: z
          .string()
          .optional()
          .describe("End date filter in YYYY-MM-DD format"),
      }),
      execute: async ({ dateFrom, dateTo }) => {
        if (user.role !== "admin") {
          return { error: "You do not have permission to view analytics" };
        }
        const { analyticsService } = await import("@/domains/analytics/service");
        const data = await analyticsService.getAnalytics({ dateFrom, dateTo });
        return {
          byCategory: data.byCategory,
          byDepartment: data.byDepartment.slice(0, 10),
          byMonth: data.byMonth,
          byUser: data.byUser.slice(0, 10),
        };
      },
    }),

    navigate: tool({
      description:
        "Navigate the user to a specific page in the portal. Use this when the user asks to go somewhere.",
      inputSchema: z.object({
        path: z
          .string()
          .describe(
            'The path to navigate to, e.g. "/invoices", "/quotes", "/calendar", "/staff", "/analytics"'
          ),
      }),
      execute: async ({ path }) => {
        return { action: "navigate" as const, path };
      },
    }),

    listCategories: tool({
      description:
        "Fetch all active categories so the bot can present valid options when creating or updating invoices and quotes.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const categories = await prisma.category.findMany({
            where: { active: true },
            orderBy: { sortOrder: "asc" },
          });
          return {
            categories: categories.map((c) => ({
              id: c.id,
              name: c.name,
              label: c.label,
            })),
          };
        } catch (error) {
          console.error("Failed to fetch categories:", error);
          return { error: "Failed to fetch categories" };
        }
      },
    }),

    createInvoice: tool({
      description:
        "Create a new draft invoice. Provide staffId for Pierce College employees, or contactId/contactName for external people. At least one of staffId, contactId, or contactName is required.",
      inputSchema: z.object({
        date: z.string().describe("Invoice date in YYYY-MM-DD format"),
        staffId: z.string().optional().describe("Staff member ID (for internal Pierce College employees)"),
        contactId: z.string().optional().describe("Contact ID (for external people already in the system)"),
        contactName: z.string().optional().describe("Contact name — if no staffId or contactId, auto-creates or finds a contact with this name"),
        department: z.string().describe("Department name"),
        category: z.string().describe("Category name"),
        items: z
          .array(
            z.object({
              description: z.string(),
              quantity: z.number(),
              unitPrice: z.number(),
            })
          )
          .describe("Line items"),
        recipientEmail: z.string().optional().describe("Contact email (used when auto-creating a contact)"),
        recipientOrg: z.string().optional().describe("Contact organization (used when auto-creating a contact)"),
        accountCode: z.string().optional().describe("Account code"),
        notes: z.string().optional().describe("Notes"),
        marginEnabled: z.boolean().optional().describe("Enable margin markup"),
        marginPercent: z.number().optional().describe("Margin percentage (e.g., 15 for 15%)"),
        taxEnabled: z.boolean().optional().describe("Enable sales tax (9.75%)"),
      }),
      execute: async ({ date, staffId, contactId, contactName, department, category, items, recipientEmail, recipientOrg, accountCode, notes, marginEnabled, marginPercent, taxEnabled }) => {
        // Resolve contact if needed
        let resolvedContactId = contactId;

        // Verify explicit contactId belongs to the current user
        if (contactId && !staffId) {
          const owned = await contactService.findById(contactId, user.id);
          if (!owned) {
            return { error: "Contact not found or does not belong to you" };
          }
        }

        if (!staffId && !contactId && contactName) {
          const contact = await contactService.findOrCreate(contactName, user.id, { department, email: recipientEmail, org: recipientOrg });
          resolvedContactId = contact.id;
        }

        if (!staffId && !resolvedContactId) {
          return { error: "Either a staff member or contact must be specified" };
        }

        const invoice = await invoiceService.create(
          { date, staffId, contactId: resolvedContactId, department, category, items, accountCode, notes, marginEnabled, marginPercent, taxEnabled },
          user.id
        );
        return {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          status: invoice.status,
          totalAmount: invoice.totalAmount,
          link: `/invoices/${invoice.id}`,
          message: `Draft invoice created. Total: $${invoice.totalAmount}. [View Invoice](/invoices/${invoice.id})`,
        };
      },
    }),

    createQuote: tool({
      description:
        "Create a new draft quote. Provide staffId for Pierce College employees, or contactId/contactName for external people. At least one of staffId, contactId, or contactName is required.",
      inputSchema: z.object({
        date: z.string().describe("Quote date in YYYY-MM-DD format"),
        staffId: z.string().optional().describe("Staff member ID (for internal Pierce College employees)"),
        contactId: z.string().optional().describe("Contact ID (for external people already in the system)"),
        contactName: z.string().optional().describe("Contact name — if no staffId or contactId, auto-creates or finds a contact with this name"),
        department: z.string().describe("Department name"),
        category: z.string().describe("Category name"),
        items: z
          .array(
            z.object({
              description: z.string(),
              quantity: z.number(),
              unitPrice: z.number(),
              isTaxable: z.boolean().optional(),
            })
          )
          .describe("Line items"),
        recipientName: z.string().describe("Recipient name"),
        expirationDate: z.string().describe("Expiration date in YYYY-MM-DD format"),
        recipientEmail: z.string().optional().describe("Recipient email"),
        recipientOrg: z.string().optional().describe("Recipient organization"),
        accountCode: z.string().optional().describe("Account code"),
        notes: z.string().optional().describe("Notes"),
        marginEnabled: z.boolean().optional().describe("Enable margin markup"),
        marginPercent: z.number().optional().describe("Margin percentage (e.g., 15 for 15%)"),
        taxEnabled: z.boolean().optional().describe("Enable sales tax (9.75%)"),
        isCateringEvent: z.boolean().optional().describe("Whether this is a catering event. If true, tell the user to fill in catering details on the quote form."),
      }),
      execute: async ({
        date,
        staffId,
        contactId,
        contactName,
        department,
        category,
        items,
        recipientName,
        expirationDate,
        recipientEmail,
        recipientOrg,
        accountCode,
        notes,
        marginEnabled,
        marginPercent,
        taxEnabled,
        isCateringEvent,
      }) => {
        // Resolve contact if needed
        let resolvedContactId = contactId;

        // Verify explicit contactId belongs to the current user
        if (contactId && !staffId) {
          const owned = await contactService.findById(contactId, user.id);
          if (!owned) {
            return { error: "Contact not found or does not belong to you" };
          }
        }

        if (!staffId && !contactId && contactName) {
          const contact = await contactService.findOrCreate(contactName, user.id, { department, email: recipientEmail, org: recipientOrg });
          resolvedContactId = contact.id;
        }

        if (!staffId && !resolvedContactId) {
          return { error: "Either a staff member or contact must be specified" };
        }

        const quote = await quoteService.create(
          {
            date,
            staffId,
            contactId: resolvedContactId,
            department,
            category,
            items,
            recipientName,
            expirationDate,
            recipientEmail,
            recipientOrg,
            accountCode,
            notes,
            marginEnabled,
            marginPercent,
            taxEnabled,
            isCateringEvent,
          },
          user.id
        );
        return {
          id: quote.id,
          quoteNumber: quote.quoteNumber,
          quoteStatus: quote.quoteStatus,
          totalAmount: quote.totalAmount,
          recipientName: quote.recipientName,
          link: `/quotes/${quote.id}`,
          message: `Draft quote created for ${quote.recipientName}. Total: $${quote.totalAmount}. [View Quote](/quotes/${quote.id})`,
        };
      },
    }),

    updateInvoice: tool({
      description:
        "Update a draft invoice. Only the invoice owner (or admin) can update it. Returns updated summary.",
      inputSchema: z.object({
        id: z.string().describe("Invoice ID"),
        date: z.string().optional().describe("New date in YYYY-MM-DD format"),
        staffId: z.string().optional().describe("New staff member ID"),
        department: z.string().optional().describe("New department"),
        category: z.string().optional().describe("New category"),
        accountCode: z.string().optional().describe("New account code"),
        notes: z.string().optional().describe("New notes"),
        items: z
          .array(
            z.object({
              description: z.string(),
              quantity: z.number(),
              unitPrice: z.number(),
            })
          )
          .optional()
          .describe("Replacement line items"),
      }),
      execute: async ({ id, ...input }) => {
        const existing = await invoiceService.getById(id);
        if (!existing) {
          return { error: "Invoice not found" };
        }
        if (user.role !== "admin" && existing.creatorId !== user.id) {
          return { error: "You do not have permission to update this invoice" };
        }
        if (existing.type === "QUOTE") {
          return { error: "Use updateQuote tool to modify quotes" };
        }
        const updated = await invoiceService.update(id, input);
        return {
          id: updated.id,
          invoiceNumber: updated.invoiceNumber,
          status: updated.status,
          totalAmount: updated.totalAmount,
          message: `Invoice updated successfully.`,
        };
      },
    }),

    updateQuote: tool({
      description:
        "Update a draft or sent quote. Only the quote owner (or admin) can update it. Returns updated summary.",
      inputSchema: z.object({
        id: z.string().describe("Quote ID"),
        date: z.string().optional().describe("New date in YYYY-MM-DD format"),
        staffId: z.string().optional().describe("New staff member ID"),
        department: z.string().optional().describe("New department"),
        category: z.string().optional().describe("New category"),
        notes: z.string().optional().describe("New notes"),
        recipientName: z.string().optional().describe("New recipient name"),
        recipientEmail: z.string().optional().describe("New recipient email"),
        expirationDate: z.string().optional().describe("New expiration date in YYYY-MM-DD format"),
        marginEnabled: z.boolean().optional().describe("Enable margin markup"),
        marginPercent: z.number().optional().describe("Margin percentage"),
        taxEnabled: z.boolean().optional().describe("Enable tax"),
        items: z
          .array(
            z.object({
              description: z.string(),
              quantity: z.number(),
              unitPrice: z.number(),
              isTaxable: z.boolean().optional(),
            })
          )
          .optional()
          .describe("Replacement line items"),
      }),
      execute: async ({ id, ...input }) => {
        const existing = await quoteService.getById(id);
        if (!existing) {
          return { error: "Quote not found" };
        }
        if (user.role !== "admin" && existing.creatorId !== user.id) {
          return { error: "You do not have permission to update this quote" };
        }
        const updated = await quoteService.update(id, input);
        return {
          id: updated.id,
          quoteNumber: updated.quoteNumber,
          quoteStatus: updated.quoteStatus,
          totalAmount: updated.totalAmount,
          recipientName: updated.recipientName,
          message: `Quote updated successfully.`,
        };
      },
    }),

    markQuoteSent: tool({
      description:
        "Mark a draft quote as sent and generate a share link. Only the quote owner (or admin) can do this.",
      inputSchema: z.object({
        id: z.string().describe("Quote ID"),
      }),
      execute: async ({ id }) => {
        const existing = await quoteService.getById(id);
        if (!existing) {
          return { error: "Quote not found" };
        }
        if (user.role !== "admin" && existing.creatorId !== user.id) {
          return { error: "You do not have permission to send this quote" };
        }
        const { shareToken } = await quoteService.markSent(id);
        const baseUrl = process.env.NEXTAUTH_URL ?? "";
        if (!baseUrl) {
          console.warn("NEXTAUTH_URL not configured; share URL will be relative");
        }
        const shareUrl = `${baseUrl}/quotes/review/${shareToken}`;
        return {
          shareToken,
          shareUrl,
          message: `Quote marked as sent. Share link: ${shareUrl}`,
        };
      },
    }),

    updateCalendarEvent: tool({
      description: "Update an existing calendar event. All users can update events.",
      inputSchema: z.object({
        id: z.string().describe("Event ID"),
        title: z.string().optional().describe("New title"),
        type: z
          .enum(["MEETING", "SEMINAR", "VENDOR", "OTHER"])
          .optional()
          .describe("New event type"),
        date: z.string().optional().describe("New date in YYYY-MM-DD format"),
        startTime: z.string().nullable().optional().describe("New start time in HH:MM format (24h), or null to clear"),
        endTime: z.string().nullable().optional().describe("New end time in HH:MM format (24h), or null to clear"),
        allDay: z.boolean().optional().describe("Whether this is an all-day event"),
        location: z.string().nullable().optional().describe("New location, or null to clear"),
        description: z.string().nullable().optional().describe("New description, or null to clear"),
        recurrence: z
          .enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"])
          .nullable()
          .optional()
          .describe("Recurrence pattern, or null to clear"),
        reminderMinutes: z.number().nullable().optional().describe("Reminder in minutes before event"),
      }),
      execute: async ({ id, type, description, location, startTime, endTime, recurrence, reminderMinutes, ...rest }) => {
        const input: UpdateEventInput = {
          ...rest,
          ...(type ? { type: type as EventType } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(location !== undefined ? { location } : {}),
          ...(startTime !== undefined ? { startTime } : {}),
          ...(endTime !== undefined ? { endTime } : {}),
          ...(recurrence !== undefined ? { recurrence } : {}),
          ...(reminderMinutes !== undefined ? { reminderMinutes } : {}),
        };
        const updated = await eventService.update(id, input);
        if (!updated) {
          return { error: "Calendar event not found" };
        }
        return {
          id: updated.id,
          title: updated.title,
          date: updated.date,
          type: updated.type,
          message: `Event "${updated.title}" updated.`,
        };
      },
    }),

    deleteCalendarEvent: tool({
      description: "Delete a calendar event. All users can delete events.",
      inputSchema: z.object({
        id: z.string().describe("Event ID"),
      }),
      execute: async ({ id }) => {
        await eventService.remove(id);
        return { success: true, message: "Calendar event deleted." };
      },
    }),

    duplicateInvoice: tool({
      description: "Duplicate an existing invoice into a new draft",
      inputSchema: z.object({
        id: z.string().optional().describe("Invoice ID"),
        invoiceNumber: z.string().optional().describe("Invoice number (used to look up the ID if id is not provided)"),
      }),
      execute: async ({ id, invoiceNumber }) => {
        let sourceId = id;

        if (!sourceId && invoiceNumber) {
          const result = await invoiceService.list({ search: invoiceNumber, pageSize: 50 });
          const match = result.invoices.find((i) => i.invoiceNumber === invoiceNumber);
          if (!match) {
            return { error: `Invoice "${invoiceNumber}" not found` };
          }
          sourceId = match.id;
        }

        if (!sourceId) {
          return { error: "Provide either id or invoiceNumber" };
        }

        const existing = await invoiceService.getById(sourceId);
        if (!existing) {
          return { error: "Invoice not found" };
        }
        if (user.role !== "admin" && existing.creatorId !== user.id) {
          return { error: "You do not have permission to duplicate this invoice" };
        }

        const duplicate = await invoiceService.duplicate(sourceId, user.id);
        return {
          id: duplicate.id,
          invoiceNumber: duplicate.invoiceNumber,
          message: `Duplicated as draft. [View Invoice](/invoices/${duplicate.id})`,
        };
      },
    }),

    duplicateQuote: tool({
      description: "Duplicate an existing quote into a new draft",
      inputSchema: z.object({
        id: z.string().optional().describe("Quote ID"),
        quoteNumber: z.string().optional().describe("Quote number (used to look up the ID if id is not provided)"),
      }),
      execute: async ({ id, quoteNumber }) => {
        let sourceId = id;

        if (!sourceId && quoteNumber) {
          const result = await quoteService.list({ search: quoteNumber, pageSize: 50 });
          const match = result.quotes.find((q) => q.quoteNumber === quoteNumber);
          if (!match) {
            return { error: `Quote "${quoteNumber}" not found` };
          }
          sourceId = match.id;
        }

        if (!sourceId) {
          return { error: "Provide either id or quoteNumber" };
        }

        const existing = await quoteService.getById(sourceId);
        if (!existing) {
          return { error: "Quote not found" };
        }
        if (user.role !== "admin" && existing.creatorId !== user.id) {
          return { error: "You do not have permission to duplicate this quote" };
        }

        const duplicate = await quoteService.duplicate(sourceId, user.id);
        return {
          id: duplicate.id,
          quoteNumber: duplicate.quoteNumber,
          message: `Duplicated as draft. [View Quote](/quotes/${duplicate.id})`,
        };
      },
    }),

    listTemplates: tool({
      description: "List the user's saved invoice/quote templates",
      inputSchema: z.object({
        type: z.enum(["INVOICE", "QUOTE"]).optional().describe("Filter by template type"),
      }),
      execute: async ({ type }) => {
        const { templateService } = await import("@/domains/template/service");
        const templates = await templateService.list(user.id, type);
        return {
          templates: templates.map((t) => ({
            id: t.id,
            name: t.name,
            type: t.type,
            department: t.department,
            category: t.category,
            itemCount: t.items.length,
            createdAt: t.createdAt,
          })),
          total: templates.length,
        };
      },
    }),

    createFromTemplate: tool({
      description: "Create a new invoice or quote from a saved template",
      inputSchema: z.object({
        templateId: z.string().optional().describe("Template ID"),
        templateName: z.string().optional().describe("Template name (used to find the template if templateId is not provided)"),
        staffId: z.string().optional().describe("Override staff member ID"),
        date: z.string().optional().describe("Override date in YYYY-MM-DD format"),
      }),
      execute: async ({ templateId, templateName, staffId, date }) => {
        const { templateService } = await import("@/domains/template/service");

        let template = null;
        if (templateId) {
          template = await templateService.getById(templateId, user.id);
        } else if (templateName) {
          const all = await templateService.list(user.id);
          template = all.find((t) => t.name.toLowerCase().includes(templateName.toLowerCase())) ?? null;
        }

        if (!template) {
          return { error: "Template not found" };
        }

        const resolvedDate = date ?? new Date().toISOString().split("T")[0];
        const resolvedStaffId = staffId ?? template.staffId ?? undefined;

        const items = template.items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          isTaxable: item.isTaxable,
          costPrice: item.costPrice ?? undefined,
          marginOverride: item.marginOverride ?? undefined,
        }));

        if (template.type === "INVOICE") {
          if (!resolvedStaffId) {
            return { error: "Template has no staff member. Provide staffId to create an invoice." };
          }
          const invoice = await invoiceService.create(
            {
              date: resolvedDate,
              staffId: resolvedStaffId,
              department: template.department,
              category: template.category,
              accountCode: template.accountCode || undefined,
              notes: template.notes || undefined,
              marginEnabled: template.marginEnabled,
              marginPercent: template.marginPercent ?? undefined,
              taxEnabled: template.taxEnabled,
              taxRate: template.taxRate,
              items,
            },
            user.id
          );
          return {
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            type: "INVOICE",
            message: `Invoice created from template "${template.name}". [View Invoice](/invoices/${invoice.id})`,
          };
        } else {
          const expirationDate = new Date();
          expirationDate.setDate(expirationDate.getDate() + 30);
          const quote = await quoteService.create(
            {
              date: resolvedDate,
              staffId: resolvedStaffId,
              department: template.department,
              category: template.category,
              accountCode: template.accountCode || undefined,
              notes: template.notes || undefined,
              marginEnabled: template.marginEnabled,
              marginPercent: template.marginPercent ?? undefined,
              taxEnabled: template.taxEnabled,
              taxRate: template.taxRate,
              isCateringEvent: template.isCateringEvent,
              items,
              recipientName: "",
              expirationDate: expirationDate.toISOString().split("T")[0],
            },
            user.id
          );
          return {
            id: quote.id,
            quoteNumber: quote.quoteNumber,
            type: "QUOTE",
            message: `Quote created from template "${template.name}". Recipient name is blank — update it on the quote form. [View Quote](/quotes/${quote.id})`,
          };
        }
      },
    }),

    finalizeInvoice: tool({
      description:
        "Finalize a draft invoice — changes status to FINAL and generates PDF. The invoice must have an invoice number (AG number) assigned before finalizing.",
      inputSchema: z.object({
        id: z.string().describe("Invoice ID"),
      }),
      execute: async ({ id }) => {
        const existing = await invoiceService.getById(id);
        if (!existing) return { error: "Invoice not found" };
        if (user.role !== "admin" && existing.creatorId !== user.id) {
          return { error: "You don't have permission to finalize this invoice" };
        }
        if (existing.status !== "DRAFT") {
          return { error: `Cannot finalize invoice with status "${existing.status}" — only DRAFT invoices can be finalized` };
        }
        try {
          const result = await invoiceService.finalize(id, {});
          return {
            pdfPath: result.pdfPath,
            message: `Invoice finalized and PDF generated. [View Invoice](/invoices/${id})`,
          };
        } catch (err) {
          return { error: (err as Error).message ?? "Failed to finalize invoice" };
        }
      },
    }),

    deleteInvoice: tool({
      description:
        "Move an invoice to the Deleted Archive. Owners can archive their own invoices, and admins can archive any invoice. ALWAYS ask the user to confirm before archiving.",
      inputSchema: z.object({
        id: z.string().describe("Invoice ID"),
        confirmed: z.boolean().describe("Whether the user has confirmed deletion"),
      }),
      execute: async ({ id, confirmed }) => {
        if (!confirmed) return { error: "Please confirm you want to delete this invoice" };
        const existing = await invoiceService.getById(id, { includeArchived: true });
        if (!existing) return { error: "Invoice not found" };
        if (existing.type !== "INVOICE") {
          return { error: "Record is not an invoice" };
        }
        if (user.role !== "admin" && existing.creatorId !== user.id) {
          return { error: "You don't have permission to delete this invoice" };
        }
        if (existing.archivedAt) {
          return { message: `Invoice is already in the Deleted Archive. [View Invoice](/invoices/${id})` };
        }
        try {
          await invoiceService.archive(id, user.id);
          return { message: `Invoice moved to the Deleted Archive. [View Invoice](/invoices/${id})` };
        } catch (err) {
          return { error: (err as Error).message ?? "Failed to delete invoice" };
        }
      },
    }),

    deleteQuote: tool({
      description:
        "Move a quote to the Deleted Archive. Owners can archive their own quotes, and admins can archive any quote. ALWAYS ask the user to confirm before archiving.",
      inputSchema: z.object({
        id: z.string().describe("Quote ID"),
        confirmed: z.boolean().describe("Whether the user has confirmed deletion"),
      }),
      execute: async ({ id, confirmed }) => {
        if (!confirmed) return { error: "Please confirm you want to delete this quote" };
        const existing = await quoteService.getById(id, { includeArchived: true });
        if (!existing) return { error: "Quote not found" };
        if (user.role !== "admin" && existing.creatorId !== user.id) {
          return { error: "You don't have permission to delete this quote" };
        }
        if (existing.archivedAt) {
          return { message: `Quote is already in the Deleted Archive. [View Quote](/quotes/${id})` };
        }
        try {
          await quoteService.archive(id, user.id);
          return { message: `Quote moved to the Deleted Archive. [View Quote](/quotes/${id})` };
        } catch (err) {
          return { error: (err as Error).message ?? "Failed to delete quote" };
        }
      },
    }),

    convertQuoteToInvoice: tool({
      description:
        "Convert an accepted quote with resolved payment details to a draft invoice. Copies all fields from the quote.",
      inputSchema: z.object({
        id: z.string().describe("Quote ID"),
      }),
      execute: async ({ id }) => {
        const existing = await quoteService.getById(id);
        if (!existing) return { error: "Quote not found" };
        if (user.role !== "admin" && existing.creatorId !== user.id) {
          return { error: "You don't have permission to convert this quote" };
        }
        if (existing.quoteStatus !== "ACCEPTED") {
          return { error: "Quote must be accepted before conversion" };
        }
        if (!existing.paymentDetailsResolved) {
          return { error: "Quote payment details must be resolved before conversion" };
        }
        try {
          const result = await quoteService.convertToInvoice(id, user.id);
          return {
            invoiceId: result.id,
            invoiceNumber: result.invoiceNumber,
            message: `Quote converted to invoice. [View Invoice](/invoices/${result.id})`,
          };
        } catch (err) {
          return { error: (err as Error).message ?? "Failed to convert quote" };
        }
      },
    }),

    // Staff records are shared resources (no creatorId), so admin role is
    // required for updates — unlike invoices/quotes which use owner checks.
    updateStaff: tool({
      description: "Update an existing staff member's information. Requires admin role.",
      inputSchema: z.object({
        id: z.string().describe("Staff member ID"),
        name: z.string().optional().describe("New name"),
        title: z.string().optional().describe("New title"),
        department: z.string().optional().describe("New department"),
        phone: z.string().optional().describe("New phone number"),
        extension: z.string().optional().describe("New phone extension"),
        email: z.string().optional().describe("New email address"),
        accountCode: z.string().optional().describe("New account code"),
        birthMonth: z.number().min(1).max(12).optional().describe("Birth month (1-12)"),
        birthDay: z.number().min(1).max(31).optional().describe("Birth day (1-31)"),
      }),
      execute: async ({ id, ...input }) => {
        if (user.role !== "admin") {
          return { error: "You do not have permission to update staff members" };
        }
        const existing = await staffService.getById(id);
        if (!existing) return { error: "Staff member not found" };
        const staff = await staffService.update(id, input);
        if (!staff) return { error: "Failed to update staff member" };
        return {
          id: staff.id,
          name: staff.name,
          message: `Staff member "${staff.name}" updated. [View Staff](/staff)`,
        };
      },
    }),

    // Staff creation is intentionally open to all users per business requirement
    createStaff: tool({
      description:
        "Create a new staff member. Requires name, title, and department at minimum. Can also include phone, extension, email, account code, and birthday.",
      inputSchema: z.object({
        name: z.string().describe("Full name of the staff member"),
        title: z.string().describe("Job title"),
        department: z.string().describe("Department name"),
        phone: z.string().optional().describe("Phone number"),
        extension: z.string().optional().describe("Phone extension"),
        email: z.string().optional().describe("Email address"),
        accountCode: z.string().optional().describe("Account code"),
        birthMonth: z.number().min(1).max(12).optional().describe("Birth month (1-12)"),
        birthDay: z.number().min(1).max(31).optional().describe("Birth day (1-31)"),
      }),
      execute: async (input) => {
        const staff = await staffService.create(input);
        return {
          id: staff.id,
          name: staff.name,
          title: staff.title,
          department: staff.department,
          extension: staff.extension,
          phone: staff.phone,
          email: staff.email,
          message: `Staff member "${staff.name}" created successfully (${staff.title}, ${staff.department}). [View Staff](/staff)`,
        };
      },
    }),
  };
}
