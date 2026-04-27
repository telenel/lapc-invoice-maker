import * as templateRepository from "./repository";
import type { TemplateResponse, TemplateItemResponse, CreateTemplateInput } from "./types";
import type { Prisma } from "@/generated/prisma/client";

type TemplateWithItems = Awaited<ReturnType<typeof templateRepository.findById>>;

function toTemplateResponse(template: NonNullable<TemplateWithItems>): TemplateResponse {
  const items: TemplateItemResponse[] = template.items.map((item) => ({
    id: item.id,
    description: item.description,
    quantity: Number(item.quantity),
    unitPrice: Number(item.unitPrice),
    sortOrder: item.sortOrder,
    sku: item.sku,
    isTaxable: item.isTaxable,
    costPrice: item.costPrice != null ? Number(item.costPrice) : null,
    marginOverride: item.marginOverride != null ? Number(item.marginOverride) : null,
  }));

  return {
    id: template.id,
    name: template.name,
    type: template.type as "INVOICE" | "QUOTE",
    staffId: template.staffId,
    department: template.department,
    category: template.category,
    accountCode: template.accountCode,
    marginEnabled: template.marginEnabled,
    marginPercent: template.marginPercent != null ? Number(template.marginPercent) : null,
    taxEnabled: template.taxEnabled,
    taxRate: Number(template.taxRate),
    notes: template.notes,
    isCateringEvent: template.isCateringEvent,
    cateringDetails: template.cateringDetails as Prisma.JsonValue,
    items,
    createdAt: template.createdAt.toISOString(),
  };
}

export const templateService = {
  async list(userId: string, type?: "INVOICE" | "QUOTE"): Promise<TemplateResponse[]> {
    const templates = await templateRepository.findByUser(userId, type);
    return templates.map((t) => toTemplateResponse(t as NonNullable<TemplateWithItems>));
  },

  async getById(id: string, userId: string): Promise<TemplateResponse | null> {
    const template = await templateRepository.findById(id, userId);
    if (!template) return null;
    return toTemplateResponse(template);
  },

  async create(input: CreateTemplateInput, userId: string): Promise<TemplateResponse> {
    const template = await templateRepository.create(input, userId);
    return toTemplateResponse(template as NonNullable<TemplateWithItems>);
  },

  async delete(id: string, userId: string): Promise<void> {
    await templateRepository.deleteById(id, userId);
  },
};
