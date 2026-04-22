import { Prisma, type QuickPickSection } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { computeEffectivePredicate } from "./filters";
import type {
  QuickPickSectionDto,
  QuickPickSectionFormValues,
  QuickPickSectionMutationInput,
  QuickPickSectionPatchInput,
  QuickPickSectionPreviewProduct,
  QuickPickSectionPreviewResult,
  QuickPickSectionScopeInput,
  QuickPickSectionItemType,
} from "./types";

interface CountRow {
  count: bigint | number | string;
}

interface PreviewRow {
  sku: bigint | number | string;
  item_type: string;
  title: string | null;
  description: string | null;
  catalog_number: string | null;
  author: string | null;
  isbn: string | null;
  edition: string | null;
  discontinued: boolean | null;
}

const SECTION_ORDER_BY = [{ sortOrder: "asc" as const }, { name: "asc" as const }];

export class QuickPickSectionSlugConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuickPickSectionSlugConflictError";
  }
}

function cleanString(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function cleanOptionalString(value: string | null | undefined): string | null {
  const trimmed = cleanString(value);
  return trimmed.length > 0 ? trimmed : null;
}

function cleanItemType(
  value: QuickPickSectionFormValues["itemType"] | null | undefined,
): QuickPickSectionItemType | null {
  const trimmed = cleanString(value);
  return trimmed.length > 0 ? (trimmed as QuickPickSectionItemType) : null;
}

function cleanIds(values: number[] | undefined): number[] {
  const deduped = new Set<number>();
  for (const value of values ?? []) {
    const next = Math.trunc(Number(value));
    if (Number.isFinite(next) && next > 0) {
      deduped.add(next);
    }
  }
  return Array.from(deduped);
}

function normalizeScopeInput(input: QuickPickSectionScopeInput) {
  return {
    descriptionLike: cleanString(input.descriptionLike),
    dccIds: cleanIds(input.dccIds),
    vendorIds: cleanIds(input.vendorIds),
    itemType: cleanItemType(input.itemType),
    explicitSkus: cleanIds(input.explicitSkus),
    includeDiscontinued: Boolean(input.includeDiscontinued),
  };
}

function normalizeMutationInput(input: QuickPickSectionMutationInput) {
  const scope = normalizeScopeInput(input);
  return {
    name: cleanString(input.name),
    slug: cleanString(input.slug),
    description: cleanOptionalString(input.description),
    icon: cleanOptionalString(input.icon),
    sortOrder: Math.trunc(Number(input.sortOrder ?? 0)),
    isGlobal: Boolean(input.isGlobal),
    createdByUserId: input.createdByUserId ?? null,
    ...scope,
  };
}

function normalizePatchInput(input: QuickPickSectionPatchInput) {
  return {
    name: input.name === undefined ? undefined : cleanString(input.name),
    slug: input.slug === undefined ? undefined : cleanString(input.slug),
    description: input.description === undefined ? undefined : cleanOptionalString(input.description),
    icon: input.icon === undefined ? undefined : cleanOptionalString(input.icon),
    sortOrder: input.sortOrder === undefined ? undefined : Math.trunc(Number(input.sortOrder)),
    descriptionLike:
      input.descriptionLike === undefined ? undefined : cleanString(input.descriptionLike),
    dccIds: input.dccIds === undefined ? undefined : cleanIds(input.dccIds),
    vendorIds: input.vendorIds === undefined ? undefined : cleanIds(input.vendorIds),
    itemType: input.itemType === undefined ? undefined : cleanItemType(input.itemType),
    explicitSkus: input.explicitSkus === undefined ? undefined : cleanIds(input.explicitSkus),
    isGlobal: input.isGlobal === undefined ? undefined : Boolean(input.isGlobal),
    includeDiscontinued:
      input.includeDiscontinued === undefined ? undefined : Boolean(input.includeDiscontinued),
  };
}

export function slugifyQuickPickSectionName(value: string): string {
  const normalized = cleanString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "quick-pick-section";
}

async function assertUniqueSlug(slug: string, excludeId?: string) {
  const existing = await prisma.quickPickSection.findFirst({
    where: excludeId
      ? {
          slug,
          NOT: { id: excludeId },
        }
      : { slug },
    select: { id: true },
  });

  if (existing) {
    throw new QuickPickSectionSlugConflictError(`Slug "${slug}" already exists.`);
  }
}

function toNumber(value: bigint | number | string): number {
  return Number(value);
}

function toPreviewProduct(row: PreviewRow): QuickPickSectionPreviewProduct {
  return {
    sku: toNumber(row.sku),
    itemType: row.item_type,
    title: row.title,
    description: row.description,
    catalogNumber: row.catalog_number,
    author: row.author,
    isbn: row.isbn,
    edition: row.edition,
    discontinued: row.discontinued,
  };
}

async function countMatchingProducts(scope: QuickPickSectionScopeInput): Promise<number> {
  const predicate = computeEffectivePredicate(normalizeScopeInput(scope));
  if (predicate.isEmpty) {
    return 0;
  }

  const { sql, params } = predicate.buildSql({ tableAlias: "pwd" });
  const rows = await prisma.$queryRawUnsafe<CountRow[]>(
    `SELECT COUNT(*)::int AS count FROM products_with_derived pwd WHERE ${sql}`,
    ...params,
  );

  return rows.length > 0 ? toNumber(rows[0].count) : 0;
}

export async function previewQuickPickSection(
  scope: QuickPickSectionScopeInput,
): Promise<QuickPickSectionPreviewResult> {
  const normalized = normalizeScopeInput(scope);
  const predicate = computeEffectivePredicate(normalized);

  if (predicate.isEmpty) {
    return {
      isEmpty: true,
      productCount: 0,
      products: [],
    };
  }

  const count = await countMatchingProducts(normalized);
  const { sql, params } = predicate.buildSql({ tableAlias: "pwd" });
  const limitPlaceholder = `$${params.length + 1}`;
  const rows = await prisma.$queryRawUnsafe<PreviewRow[]>(
    `
      SELECT
        pwd.sku,
        pwd.item_type,
        pwd.title,
        pwd.description,
        pwd.catalog_number,
        pwd.author,
        pwd.isbn,
        pwd.edition,
        pwd.discontinued
      FROM products_with_derived pwd
      WHERE ${sql}
      ORDER BY COALESCE(pwd.title, pwd.description, '') ASC, pwd.sku ASC
      LIMIT ${limitPlaceholder}
    `,
    ...params,
    20,
  );

  return {
    isEmpty: false,
    productCount: count,
    products: rows.map(toPreviewProduct),
  };
}

export function summarizeQuickPickSectionScope(scope: QuickPickSectionScopeInput): string {
  const parts: string[] = [];
  const normalized = normalizeScopeInput(scope);

  if (normalized.descriptionLike) {
    parts.push(`Description like ${normalized.descriptionLike}`);
  }
  if (normalized.dccIds.length > 0) {
    parts.push(`${normalized.dccIds.length} DCC${normalized.dccIds.length === 1 ? "" : "s"}`);
  }
  if (normalized.vendorIds.length > 0) {
    parts.push(`${normalized.vendorIds.length} vendor${normalized.vendorIds.length === 1 ? "" : "s"}`);
  }
  if (normalized.itemType) {
    parts.push(`Item type ${normalized.itemType}`);
  }
  if (normalized.explicitSkus.length > 0) {
    parts.push(`${normalized.explicitSkus.length} SKU${normalized.explicitSkus.length === 1 ? "" : "s"}`);
  }
  if (normalized.includeDiscontinued) {
    parts.push("Includes discontinued");
  }

  return parts.length > 0 ? parts.join(" • ") : "No scope filters";
}

async function toSectionDto(section: QuickPickSection): Promise<QuickPickSectionDto> {
  const scope = {
    descriptionLike: section.descriptionLike ?? "",
    dccIds: section.dccIds,
    vendorIds: section.vendorIds,
    itemType: (section.itemType as QuickPickSectionItemType | null) ?? "",
    explicitSkus: section.explicitSkus,
    includeDiscontinued: section.includeDiscontinued,
  } satisfies QuickPickSectionScopeInput;

  return {
    id: section.id,
    name: section.name,
    slug: section.slug,
    description: section.description ?? null,
    icon: section.icon as QuickPickSectionDto["icon"],
    sortOrder: section.sortOrder,
    descriptionLike: section.descriptionLike ?? null,
    dccIds: [...section.dccIds],
    vendorIds: [...section.vendorIds],
    itemType: (section.itemType as QuickPickSectionItemType | null) ?? null,
    explicitSkus: [...section.explicitSkus],
    isGlobal: section.isGlobal,
    includeDiscontinued: section.includeDiscontinued,
    productCount: await countMatchingProducts(scope),
    createdByUserId: section.createdByUserId ?? null,
    createdAt: section.createdAt.toISOString(),
    updatedAt: section.updatedAt.toISOString(),
    scopeSummary: summarizeQuickPickSectionScope(scope),
  };
}

export async function listQuickPickSections(input: {
  role: string;
  userId?: string | null;
}): Promise<QuickPickSectionDto[]> {
  const sections = await prisma.quickPickSection.findMany({
    where: input.role === "admin" ? undefined : { isGlobal: true },
    orderBy: SECTION_ORDER_BY,
  });

  return Promise.all(sections.map((section) => toSectionDto(section)));
}

export async function createQuickPickSection(
  input: QuickPickSectionMutationInput,
): Promise<QuickPickSectionDto> {
  const normalized = normalizeMutationInput(input);
  const slug = normalized.slug || slugifyQuickPickSectionName(normalized.name);

  await assertUniqueSlug(slug);

  try {
    const created = await prisma.quickPickSection.create({
      data: {
        name: normalized.name,
        slug,
        description: normalized.description,
        icon: normalized.icon,
        sortOrder: normalized.sortOrder,
        descriptionLike: normalized.descriptionLike || null,
        dccIds: normalized.dccIds,
        vendorIds: normalized.vendorIds,
        itemType: normalized.itemType,
        explicitSkus: normalized.explicitSkus,
        isGlobal: normalized.isGlobal,
        includeDiscontinued: normalized.includeDiscontinued,
        createdByUserId: normalized.createdByUserId,
      },
    });

    return toSectionDto(created);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError
      && error.code === "P2002"
    ) {
      throw new QuickPickSectionSlugConflictError(`Slug "${slug}" already exists.`);
    }
    throw error;
  }
}

export async function updateQuickPickSection(
  id: string,
  input: QuickPickSectionPatchInput,
): Promise<QuickPickSectionDto | null> {
  const existing = await prisma.quickPickSection.findUnique({ where: { id } });
  if (!existing) {
    return null;
  }

  const normalized = normalizePatchInput(input);
  const nextSlug = normalized.slug !== undefined
    ? (normalized.slug || slugifyQuickPickSectionName(normalized.name ?? existing.name))
    : existing.slug;

  if (nextSlug !== existing.slug) {
    await assertUniqueSlug(nextSlug, id);
  }

  try {
    const updated = await prisma.quickPickSection.update({
      where: { id },
      data: {
        name: normalized.name ?? existing.name,
        slug: nextSlug,
        description: normalized.description ?? existing.description,
        icon: normalized.icon ?? existing.icon,
        sortOrder: normalized.sortOrder ?? existing.sortOrder,
        descriptionLike:
          normalized.descriptionLike !== undefined
            ? (normalized.descriptionLike || null)
            : existing.descriptionLike,
        dccIds: normalized.dccIds ?? existing.dccIds,
        vendorIds: normalized.vendorIds ?? existing.vendorIds,
        itemType: normalized.itemType !== undefined ? normalized.itemType : existing.itemType,
        explicitSkus: normalized.explicitSkus ?? existing.explicitSkus,
        isGlobal: normalized.isGlobal ?? existing.isGlobal,
        includeDiscontinued:
          normalized.includeDiscontinued ?? existing.includeDiscontinued,
      },
    });

    return toSectionDto(updated);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError
      && error.code === "P2002"
    ) {
      throw new QuickPickSectionSlugConflictError(`Slug "${nextSlug}" already exists.`);
    }
    throw error;
  }
}

export async function deleteQuickPickSection(
  id: string,
): Promise<"deleted" | "not_found"> {
  const existing = await prisma.quickPickSection.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    return "not_found";
  }

  await prisma.quickPickSection.delete({ where: { id } });
  return "deleted";
}
