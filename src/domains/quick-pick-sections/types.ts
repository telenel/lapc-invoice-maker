import type { ProductFilters } from "@/domains/product/types";

export const QUICK_PICK_SECTION_ICON_NAMES = [
  "Printer",
  "Package2",
  "BookOpen",
  "GraduationCap",
  "ShoppingBag",
  "Tags",
  "ClipboardList",
  "Wrench",
  "Sparkles",
  "Star",
  "BadgePercent",
] as const;

export const QUICK_PICK_SECTION_ITEM_TYPE_OPTIONS = [
  "textbook",
  "used_textbook",
  "general_merchandise",
  "supplies",
  "other",
] as const satisfies ReadonlyArray<Exclude<ProductFilters["itemType"], "">>;

export type QuickPickSectionIconName = (typeof QUICK_PICK_SECTION_ICON_NAMES)[number];
export type QuickPickSectionItemType = (typeof QUICK_PICK_SECTION_ITEM_TYPE_OPTIONS)[number];

const QUICK_PICK_SECTION_ICON_NAME_SET = new Set<string>(QUICK_PICK_SECTION_ICON_NAMES);

export function isQuickPickSectionIconName(
  value: string | null | undefined,
): value is QuickPickSectionIconName {
  return typeof value === "string" && QUICK_PICK_SECTION_ICON_NAME_SET.has(value);
}

export interface QuickPickSectionScopeInput {
  descriptionLike: string;
  dccIds: number[];
  vendorIds: number[];
  itemType: QuickPickSectionItemType | "" | null;
  explicitSkus: number[];
  includeDiscontinued: boolean;
}

export interface QuickPickSectionFormValues extends QuickPickSectionScopeInput {
  name: string;
  slug: string;
  description: string;
  icon: QuickPickSectionIconName | "";
  sortOrder: number;
  isGlobal: boolean;
}

export interface QuickPickSectionMutationInput extends QuickPickSectionFormValues {
  createdByUserId?: string | null;
}

export type QuickPickSectionPatchInput = Partial<QuickPickSectionFormValues>;

export interface QuickPickSectionDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: QuickPickSectionIconName | null;
  sortOrder: number;
  descriptionLike: string | null;
  dccIds: number[];
  vendorIds: number[];
  itemType: QuickPickSectionItemType | null;
  explicitSkus: number[];
  isGlobal: boolean;
  includeDiscontinued: boolean;
  productCount: number;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  scopeSummary: string;
}

export interface QuickPickSectionPreviewProduct {
  sku: number;
  itemType: string;
  title: string | null;
  description: string | null;
  catalogNumber: string | null;
  author: string | null;
  isbn: string | null;
  edition: string | null;
  discontinued: boolean | null;
}

export interface QuickPickSectionPreviewResult {
  isEmpty: boolean;
  productCount: number;
  products: QuickPickSectionPreviewProduct[];
}
