// src/domains/chat/tools.ts
import { tool } from "ai";
import { z } from "zod";
import { invoiceService } from "@/domains/invoice/service";
import { quoteService } from "@/domains/quote/service";
import { staffService } from "@/domains/staff/service";
import { eventService } from "@/domains/event/service";
import { prisma } from "@/lib/prisma";
import type { ChatUser } from "./types";
import type { InvoiceFilters } from "@/domains/invoice/types";
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
            staffName: inv.staff.name,
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
          .enum(["DRAFT", "FINAL", "PENDING_CHARGE"])
          .optional()
          .describe("Filter by quote status"),
        search: z.string().optional().describe("Search term"),
        page: z.number().optional().describe("Page number (default 1)"),
        pageSize: z.number().optional().describe("Results per page (default 10)"),
      }),
      execute: async ({ status, search, page, pageSize }) => {
        const filters: InvoiceFilters = {
          status,
          search,
          page: page ?? 1,
          pageSize: pageSize ?? 10,
        };
        // Quotes are stored as invoices; the quote system uses the same list method
        const result = await invoiceService.list(filters);
        return {
          quotes: result.invoices.map((inv) => ({
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            status: inv.status,
            department: inv.department,
            totalAmount: inv.totalAmount,
            date: inv.date,
            staffName: inv.staff.name,
            creatorName: inv.creatorName,
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
        if (!invoice) {
          return { error: "Invoice not found" };
        }
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
          staffName: invoice.staff.name,
          creatorId: invoice.creatorId,
          creatorName: invoice.creatorName,
          items: invoice.items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            extendedPrice: item.extendedPrice,
          })),
        };
      },
    }),

    searchStaff: tool({
      description:
        "Search staff members by name, department, or title. Returns name, title, department, email, phone, and extension.",
      inputSchema: z.object({
        search: z.string().describe("Search term for name, department, or title"),
      }),
      execute: async ({ search }) => {
        const staff = await staffService.list({ search });
        return {
          staff: staff.slice(0, 20).map((s) => ({
            id: s.id,
            name: s.name,
            title: s.title,
            department: s.department,
            email: s.email,
            phone: s.phone,
            extension: s.extension,
          })),
          total: staff.length,
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
        "Create a new draft invoice. Returns the new invoice ID, number, status, and total amount.",
      inputSchema: z.object({
        date: z.string().describe("Invoice date in YYYY-MM-DD format"),
        staffId: z.string().describe("Staff member ID"),
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
        accountCode: z.string().optional().describe("Account code"),
        notes: z.string().optional().describe("Notes"),
      }),
      execute: async ({ date, staffId, department, category, items, accountCode, notes }) => {
        const invoice = await invoiceService.create(
          { date, staffId, department, category, items, accountCode, notes },
          user.id
        );
        return {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          status: invoice.status,
          totalAmount: invoice.totalAmount,
          message: `Draft invoice created successfully${invoice.invoiceNumber ? ` (${invoice.invoiceNumber})` : ""}.`,
        };
      },
    }),

    createQuote: tool({
      description:
        "Create a new draft quote. Returns the new quote ID, number, status, total, and recipient name.",
      inputSchema: z.object({
        date: z.string().describe("Quote date in YYYY-MM-DD format"),
        staffId: z.string().describe("Staff member ID"),
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
        marginPercent: z.number().optional().describe("Margin percentage"),
        taxEnabled: z.boolean().optional().describe("Enable tax"),
      }),
      execute: async ({
        date,
        staffId,
        department,
        category,
        items,
        recipientName,
        expirationDate,
        recipientEmail,
        accountCode,
        recipientOrg,
        accountCode,
        notes,
        marginEnabled,
        marginPercent,
        taxEnabled,
      }) => {
        const quote = await quoteService.create(
          {
            date,
            staffId,
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
          },
          user.id
        );
        return {
          id: quote.id,
          quoteNumber: quote.quoteNumber,
          quoteStatus: quote.quoteStatus,
          totalAmount: quote.totalAmount,
          recipientName: quote.recipientName,
          message: `Draft quote created successfully for ${quote.recipientName}${quote.quoteNumber ? ` (${quote.quoteNumber})` : ""}.`,
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
  };
}
