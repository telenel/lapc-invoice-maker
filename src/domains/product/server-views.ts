import { Prisma, type SavedSearch as SavedSearchRecord } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { SYSTEM_PRESET_VIEWS } from "./presets";
import type { SavedView } from "./types";

type SavedSearchViewRow = Pick<
  SavedSearchRecord,
  | "id"
  | "name"
  | "description"
  | "filter"
  | "columnPreferences"
  | "isSystem"
  | "slug"
  | "presetGroup"
  | "sortOrder"
>;

export class ProductViewDuplicateError extends Error {
  readonly nameValue: string;

  constructor(nameValue: string) {
    super(`A view named "${nameValue}" already exists.`);
    this.name = "ProductViewDuplicateError";
    this.nameValue = nameValue;
  }
}

export function savedSearchRowToView(row: SavedSearchViewRow): SavedView {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    filter: (row.filter as SavedView["filter"]) ?? {},
    columnPreferences:
      (row.columnPreferences as SavedView["columnPreferences"]) ?? null,
    isSystem: row.isSystem,
    slug: row.slug ?? null,
    presetGroup: (row.presetGroup as SavedView["presetGroup"]) ?? null,
    sortOrder: row.sortOrder ?? null,
  };
}

export async function listProductViews(userId?: string | null): Promise<{
  system: SavedView[];
  mine: SavedView[];
}> {
  const mineRows = userId
    ? await prisma.savedSearch.findMany({
        where: {
          ownerUserId: userId,
          isSystem: false,
        },
        orderBy: { updatedAt: "desc" },
      })
    : [];

  return {
    system: SYSTEM_PRESET_VIEWS,
    mine: mineRows.map(savedSearchRowToView),
  };
}

export async function createProductView(input: {
  userId: string;
  name: string;
  description?: string | null;
  filter: Record<string, unknown>;
  columnPreferences?: SavedView["columnPreferences"];
}): Promise<SavedView> {
  const name = input.name.trim();

  const existing = await prisma.savedSearch.findFirst({
    where: {
      ownerUserId: input.userId,
      isSystem: false,
      name,
    },
    select: { id: true },
  });

  if (existing) {
    throw new ProductViewDuplicateError(name);
  }

  let created: SavedSearchRecord;
  try {
    created = await prisma.savedSearch.create({
      data: {
        ownerUserId: input.userId,
        name,
        description: input.description ?? null,
        filter: input.filter as Prisma.InputJsonValue,
        columnPreferences: input.columnPreferences
          ? (input.columnPreferences as unknown as Prisma.InputJsonValue)
          : undefined,
        isSystem: false,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError
      && error.code === "P2002"
    ) {
      throw new ProductViewDuplicateError(name);
    }
    throw error;
  }

  return savedSearchRowToView(created);
}

export async function deleteProductView(input: {
  id: string;
  userId: string;
}): Promise<"deleted" | "not_found" | "forbidden" | "system"> {
  const existing = await prisma.savedSearch.findUnique({
    where: { id: input.id },
  });

  if (!existing) return "not_found";
  if (existing.isSystem) return "system";
  if (existing.ownerUserId !== input.userId) return "forbidden";

  await prisma.savedSearch.delete({ where: { id: input.id } });
  return "deleted";
}
