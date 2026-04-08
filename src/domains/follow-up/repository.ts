// src/domains/follow-up/repository.ts
import { prisma } from "@/lib/prisma";
import {
  ACCOUNT_FOLLOWUP,
  ACCOUNT_FOLLOWUP_CLAIM,
  ACCOUNT_FOLLOWUP_TYPES,
  type FollowUpSeriesStatus,
} from "./types";

export const followUpRepository = {
  async findActiveSeriesByInvoiceId(invoiceId: string) {
    return prisma.followUp.findFirst({
      where: {
        invoiceId,
        seriesStatus: "ACTIVE",
        type: { in: [...ACCOUNT_FOLLOWUP_TYPES] },
      },
      orderBy: { sentAt: "desc" },
    });
  },

  async getLatestFollowUpForInvoice(invoiceId: string) {
    return prisma.followUp.findFirst({
      where: {
        invoiceId,
        type: { in: [...ACCOUNT_FOLLOWUP_TYPES] },
      },
      orderBy: { sentAt: "desc" },
    });
  },

  async getFollowUpBadgesForInvoices(invoiceIds: string[]) {
    if (invoiceIds.length === 0) return [];
    return prisma.followUp.findMany({
      where: {
        invoiceId: { in: invoiceIds },
        type: { in: [...ACCOUNT_FOLLOWUP_TYPES] },
        seriesStatus: { in: ["ACTIVE", "EXHAUSTED"] },
      },
      orderBy: { sentAt: "desc" },
      distinct: ["invoiceId"],
    });
  },

  async findByShareToken(token: string) {
    return prisma.followUp.findFirst({
      where: { shareToken: token },
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            quoteNumber: true,
            type: true,
            notes: true,
            totalAmount: true,
            accountNumber: true,
            createdBy: true,
            creator: { select: { name: true } },
          },
        },
      },
    });
  },

  async countAttempts(seriesId: string) {
    return prisma.followUp.count({
      where: { seriesId, type: ACCOUNT_FOLLOWUP },
    });
  },

  async markSeriesStatus(seriesId: string, status: FollowUpSeriesStatus) {
    return prisma.followUp.updateMany({
      where: { seriesId },
      data: { seriesStatus: status },
    });
  },

  async createClaimRow(data: {
    invoiceId: string;
    seriesId: string;
    shareToken: string;
    recipientEmail: string;
    subject: string;
    maxAttempts: number;
    attempt: number;
  }) {
    return prisma.followUp.create({
      data: {
        invoiceId: data.invoiceId,
        type: ACCOUNT_FOLLOWUP_CLAIM,
        recipientEmail: data.recipientEmail,
        subject: data.subject,
        seriesId: data.seriesId,
        sentAt: new Date(),
        shareToken: data.attempt === 1 ? data.shareToken : undefined,
        seriesStatus: "ACTIVE",
        maxAttempts: data.maxAttempts,
        metadata: { attempt: data.attempt },
      },
    });
  },

  async promoteClaimRow(followUpId: string) {
    return prisma.followUp.update({
      where: { id: followUpId },
      data: { type: ACCOUNT_FOLLOWUP, sentAt: new Date() },
    });
  },

  async deleteClaimRow(followUpId: string) {
    return prisma.followUp.delete({ where: { id: followUpId } }).catch(() => {});
  },

  async deleteStaleClaimsForSeries(seriesId: string, staleThreshold: Date) {
    return prisma.followUp.deleteMany({
      where: {
        seriesId,
        type: ACCOUNT_FOLLOWUP_CLAIM,
        sentAt: { lt: staleThreshold },
      },
    });
  },

  async findFreshClaimForSeries(seriesId: string, freshThreshold: Date) {
    return prisma.followUp.findFirst({
      where: {
        seriesId,
        type: ACCOUNT_FOLLOWUP_CLAIM,
        sentAt: { gte: freshThreshold },
      },
    });
  },

  async findAllActiveSeries() {
    return prisma.followUp.findMany({
      where: {
        type: { in: [...ACCOUNT_FOLLOWUP_TYPES] },
        seriesStatus: "ACTIVE",
      },
      orderBy: { sentAt: "desc" },
      distinct: ["seriesId"],
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            quoteNumber: true,
            type: true,
            notes: true,
            totalAmount: true,
            accountNumber: true,
            staffId: true,
            createdBy: true,
            staff: { select: { email: true, name: true } },
            creator: { select: { id: true, name: true } },
          },
        },
      },
    });
  },

  async getPendingAccountsCount() {
    const rows = await prisma.followUp.findMany({
      where: {
        type: { in: [...ACCOUNT_FOLLOWUP_TYPES] },
        seriesStatus: { in: ["ACTIVE", "EXHAUSTED"] },
      },
      distinct: ["seriesId"],
      select: { seriesId: true },
    });
    return rows.length;
  },

  async getPendingAccountsSummary() {
    return prisma.followUp.findMany({
      where: {
        type: { in: [...ACCOUNT_FOLLOWUP_TYPES] },
        seriesStatus: { in: ["ACTIVE", "EXHAUSTED"] },
      },
      orderBy: { sentAt: "desc" },
      distinct: ["seriesId"],
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            quoteNumber: true,
            type: true,
            createdBy: true,
            creator: { select: { id: true, name: true } },
            staff: { select: { name: true } },
          },
        },
      },
    });
  },
};
