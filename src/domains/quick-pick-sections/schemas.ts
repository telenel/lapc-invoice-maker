import { z } from "zod";
import {
  QUICK_PICK_SECTION_ICON_NAMES,
  QUICK_PICK_SECTION_ITEM_TYPE_OPTIONS,
} from "./types";

const idArraySchema = z.array(z.coerce.number().int().positive());
const optionalStringSchema = z.string().max(200).optional().nullable();
const optionalItemTypeSchema = z
  .enum(QUICK_PICK_SECTION_ITEM_TYPE_OPTIONS)
  .or(z.literal(""))
  .optional()
  .nullable();
const optionalIconSchema = z
  .enum(QUICK_PICK_SECTION_ICON_NAMES)
  .or(z.literal(""))
  .optional()
  .nullable();

export const quickPickSectionCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(1).max(120).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  icon: optionalIconSchema,
  sortOrder: z.coerce.number().int().min(-32_768).max(32_767).default(0),
  descriptionLike: optionalStringSchema,
  dccIds: idArraySchema.default([]),
  vendorIds: idArraySchema.default([]),
  itemType: optionalItemTypeSchema,
  explicitSkus: idArraySchema.default([]),
  isGlobal: z.boolean().default(true),
  includeDiscontinued: z.boolean().default(false),
});

export const quickPickSectionPatchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  slug: z.string().trim().min(1).max(120).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  icon: optionalIconSchema,
  sortOrder: z.coerce.number().int().min(-32_768).max(32_767).optional(),
  descriptionLike: optionalStringSchema,
  dccIds: idArraySchema.optional(),
  vendorIds: idArraySchema.optional(),
  itemType: optionalItemTypeSchema,
  explicitSkus: idArraySchema.optional(),
  isGlobal: z.boolean().optional(),
  includeDiscontinued: z.boolean().optional(),
});

export const quickPickSectionPreviewSchema = z.object({
  descriptionLike: optionalStringSchema,
  dccIds: idArraySchema.default([]),
  vendorIds: idArraySchema.default([]),
  itemType: optionalItemTypeSchema,
  explicitSkus: idArraySchema.default([]),
  includeDiscontinued: z.boolean().default(false),
});
