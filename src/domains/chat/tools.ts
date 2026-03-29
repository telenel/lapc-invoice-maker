// src/domains/chat/tools.ts
import { tool } from "ai";
import { z } from "zod";
import { invoiceService } from "@/domains/invoice/service";
import { staffService } from "@/domains/staff/service";
import { eventService } from "@/domains/event/service";
import type { ChatUser } from "./types";
import type { InvoiceFilters } from "@/domains/invoice/types";
import type { EventType } from "@/domains/event/types";

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
  };
}
