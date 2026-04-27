import { prisma } from "@/lib/prisma";
import type { CreateTemplateInput } from "./types";
import type { Prisma } from "@/generated/prisma/client";

const includeItems = {
  items: { orderBy: { sortOrder: "asc" as const } },
} as const;

export async function findByUser(userId: string, type?: "INVOICE" | "QUOTE") {
  const where: Prisma.TemplateWhereInput = { createdBy: userId };
  if (type) where.type = type;

  return prisma.template.findMany({
    where,
    include: includeItems,
    orderBy: { createdAt: "desc" },
  });
}

export async function findById(id: string, userId: string) {
  return prisma.template.findFirst({
    where: { id, createdBy: userId },
    include: includeItems,
  });
}

export async function create(data: CreateTemplateInput, userId: string) {
  const { items, cateringDetails, ...rest } = data;

  return prisma.template.create({
    data: {
      ...rest,
      department: rest.department ?? "",
      category: rest.category ?? "",
      accountCode: rest.accountCode ?? "",
      cateringDetails: cateringDetails as Prisma.InputJsonValue | undefined,
      createdBy: userId,
      items: {
        create: items.map((item, index) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          sortOrder: item.sortOrder ?? index,
          sku: item.sku ?? null,
          isTaxable: item.isTaxable ?? true,
          costPrice: item.costPrice ?? null,
          marginOverride: item.marginOverride ?? null,
        })),
      },
    },
    include: includeItems,
  });
}

export async function deleteById(id: string, userId: string) {
  return prisma.template.deleteMany({
    where: { id, createdBy: userId },
  });
}
