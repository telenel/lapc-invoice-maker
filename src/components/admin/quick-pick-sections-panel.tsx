"use client";

import { useCallback, useDeferredValue, useEffect, useRef, useState } from "react";
import {
  BadgePercentIcon,
  BadgeDollarSignIcon,
  BookOpenIcon,
  BookMarkedIcon,
  CalculatorIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClipboardCheckIcon,
  ClipboardListIcon,
  CoffeeIcon,
  CopyIcon,
  FileTextIcon,
  GiftIcon,
  GraduationCapIcon,
  LandmarkIcon,
  LayersIcon,
  MonitorIcon,
  NotebookPenIcon,
  Package2Icon,
  PenToolIcon,
  PrinterIcon,
  ReceiptTextIcon,
  ScanBarcodeIcon,
  ShoppingBagIcon,
  ShirtIcon,
  SparklesIcon,
  StarIcon,
  TagsIcon,
  TruckIcon,
  UtensilsIcon,
  WrenchIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { findCommittedDccMatch } from "@/components/products/dcc-picker";
import { ItemRefSelectField } from "@/components/products/item-ref-selects";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { searchProducts } from "@/domains/product/queries";
import { EMPTY_FILTERS } from "@/domains/product/constants";
import { loadDccList } from "@/domains/product/views-api";
import { useProductRefDirectory } from "@/domains/product/vendor-directory";
import { quickPickSectionsApi } from "@/domains/quick-pick-sections/api-client";
import {
  QUICK_PICK_SECTION_ICON_NAMES,
  QUICK_PICK_SECTION_ITEM_TYPE_OPTIONS,
  type QuickPickSectionDto,
  type QuickPickSectionFormValues,
  type QuickPickSectionPreviewProduct,
  type QuickPickSectionPreviewResult,
  type QuickPickSectionScopeInput,
} from "@/domains/quick-pick-sections/types";

const PREVIEW_DEBOUNCE_MS = 250;

const ICON_COMPONENTS = {
  Printer: PrinterIcon,
  Package2: Package2Icon,
  BookOpen: BookOpenIcon,
  BookMarked: BookMarkedIcon,
  GraduationCap: GraduationCapIcon,
  ShoppingBag: ShoppingBagIcon,
  Tags: TagsIcon,
  ClipboardList: ClipboardListIcon,
  ClipboardCheck: ClipboardCheckIcon,
  Wrench: WrenchIcon,
  Sparkles: SparklesIcon,
  Star: StarIcon,
  BadgePercent: BadgePercentIcon,
  BadgeDollarSign: BadgeDollarSignIcon,
  Calculator: CalculatorIcon,
  Coffee: CoffeeIcon,
  Copy: CopyIcon,
  FileText: FileTextIcon,
  Gift: GiftIcon,
  Landmark: LandmarkIcon,
  Layers: LayersIcon,
  Monitor: MonitorIcon,
  NotebookPen: NotebookPenIcon,
  PenTool: PenToolIcon,
  ReceiptText: ReceiptTextIcon,
  ScanBarcode: ScanBarcodeIcon,
  Shirt: ShirtIcon,
  Truck: TruckIcon,
  Utensils: UtensilsIcon,
} as const;

const EMPTY_FORM: QuickPickSectionFormValues = {
  name: "",
  slug: "",
  description: "",
  icon: "Package2",
  sortOrder: 0,
  descriptionLike: "",
  dccIds: [],
  vendorIds: [],
  itemType: "",
  explicitSkus: [],
  isGlobal: true,
  includeDiscontinued: false,
};

const EMPTY_PREVIEW: QuickPickSectionPreviewResult = {
  isEmpty: true,
  productCount: 0,
  products: [],
};

function sortSections(items: QuickPickSectionDto[]): QuickPickSectionDto[] {
  return [...items].sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }
    return left.name.localeCompare(right.name);
  });
}

function buildFormValues(section?: QuickPickSectionDto | null): QuickPickSectionFormValues {
  if (!section) {
    return { ...EMPTY_FORM };
  }

  return {
    name: section.name,
    slug: section.slug,
    description: section.description ?? "",
    icon: section.icon ?? "Package2",
    sortOrder: section.sortOrder,
    descriptionLike: section.descriptionLike ?? "",
    dccIds: [...section.dccIds],
    vendorIds: [...section.vendorIds],
    itemType: section.itemType ?? "",
    explicitSkus: [...section.explicitSkus],
    isGlobal: section.isGlobal,
    includeDiscontinued: section.includeDiscontinued,
  };
}

function normalizeExplicitSkus(values: number[]): number[] {
  return Array.from(new Set(values.filter((value) => Number.isInteger(value) && value > 0)))
    .sort((left, right) => left - right);
}

function isEmptyScope(scope: QuickPickSectionScopeInput): boolean {
  return (
    scope.descriptionLike.trim() === ""
    && scope.dccIds.length === 0
    && scope.vendorIds.length === 0
    && (scope.itemType ?? "") === ""
    && scope.explicitSkus.length === 0
  );
}

function scopeInputFromSection(section: Pick<
  QuickPickSectionDto,
  "descriptionLike" | "dccIds" | "vendorIds" | "itemType" | "explicitSkus" | "includeDiscontinued"
>): QuickPickSectionScopeInput {
  return {
    descriptionLike: section.descriptionLike ?? "",
    dccIds: [...section.dccIds],
    vendorIds: [...section.vendorIds],
    itemType: section.itemType ?? "",
    explicitSkus: [...section.explicitSkus],
    includeDiscontinued: section.includeDiscontinued,
  };
}

function formatItemTypeLabel(value: string): string {
  return value
    .split("_")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatIconLabel(value: string): string {
  return value
    .replace(/([a-z])([A-Z0-9])/g, "$1 $2")
    .replace(/([0-9])([A-Z])/g, "$1 $2");
}

function countPopulatedScopeFields(scope: QuickPickSectionScopeInput): number {
  return [
    scope.descriptionLike.trim() !== "",
    scope.dccIds.length > 0,
    scope.vendorIds.length > 0,
    (scope.itemType ?? "") !== "",
    scope.explicitSkus.length > 0,
  ].filter(Boolean).length;
}

function getRowTitle(product: QuickPickSectionPreviewProduct): string {
  return product.itemType === "textbook"
    ? (product.title ?? product.description ?? "")
    : (product.description ?? product.title ?? "");
}

function buildScopeRuleSummary(scope: QuickPickSectionScopeInput): string[] {
  const chips: string[] = [];

  if (scope.descriptionLike.trim()) {
    chips.push(`Description contains ${scope.descriptionLike.trim()}`);
  }
  if (scope.dccIds.length > 0) {
    chips.push(`${scope.dccIds.length} DCC${scope.dccIds.length === 1 ? "" : "s"}`);
  }
  if (scope.vendorIds.length > 0) {
    chips.push(`${scope.vendorIds.length} vendor${scope.vendorIds.length === 1 ? "" : "s"}`);
  }
  if ((scope.itemType ?? "") !== "") {
    chips.push(formatItemTypeLabel(scope.itemType ?? ""));
  }
  if (scope.explicitSkus.length > 0) {
    chips.push(`${scope.explicitSkus.length} explicit SKU${scope.explicitSkus.length === 1 ? "" : "s"}`);
  }

  return chips;
}

function IconSwatch({ name }: { name: QuickPickSectionFormValues["icon"] }) {
  const Icon = name && name in ICON_COMPONENTS
    ? ICON_COMPONENTS[name as keyof typeof ICON_COMPONENTS]
    : Package2Icon;
  return <Icon className="size-4 text-muted-foreground" aria-hidden="true" />;
}

function IconSelectLabel({ name }: { name: QuickPickSectionFormValues["icon"] }) {
  const iconName = name || "Package2";
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <span
        data-testid={`quick-pick-icon-swatch-${iconName}`}
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-border bg-background"
      >
        <IconSwatch name={iconName} />
      </span>
      <span className="truncate">{formatIconLabel(iconName)}</span>
    </span>
  );
}

function RemovableChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <Badge variant="outline" className="gap-1 pr-1">
      <span>{label}</span>
      <button
        type="button"
        aria-label={`Remove ${label}`}
        onClick={onRemove}
        className="rounded p-0.5 hover:bg-muted"
      >
        <XIcon className="size-3" aria-hidden="true" />
      </button>
    </Badge>
  );
}

function VendorMultiSelect({
  selectedIds,
  onChange,
}: {
  selectedIds: number[];
  onChange: (next: number[]) => void;
}) {
  const { refs, lookups } = useProductRefDirectory();
  const [pending, setPending] = useState("");

  return (
    <div className="space-y-2">
      <ItemRefSelectField
        refs={refs}
        kind="vendor"
        value={pending}
        onChange={(value) => {
          if (!value) {
            setPending("");
            return;
          }

          const vendorId = Number(value);
          if (!Number.isFinite(vendorId) || selectedIds.includes(vendorId)) {
            setPending("");
            return;
          }

          onChange([...selectedIds, vendorId]);
          setPending("");
        }}
        label="Vendor"
        placeholder="Add vendor"
      />
      <p className="text-xs text-muted-foreground">
        Includes products from the selected vendors.
      </p>
      {selectedIds.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selectedIds.map((vendorId) => (
            <RemovableChip
              key={vendorId}
              label={lookups.vendorNames.get(vendorId) ?? `Vendor #${vendorId}`}
              onRemove={() => onChange(selectedIds.filter((value) => value !== vendorId))}
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No vendors selected.</p>
      )}
    </div>
  );
}

function buildDccLookupKey(input: {
  deptNum: number | null;
  classNum: number | null;
  catNum: number | null;
}) {
  return `${input.deptNum ?? ""}.${input.classNum ?? ""}.${input.catNum ?? ""}`;
}

function DccMultiSelect({
  selectedIds,
  onChange,
}: {
  selectedIds: number[];
  onChange: (next: number[]) => void;
}) {
  const { refs, lookups } = useProductRefDirectory();
  const [dccItems, setDccItems] = useState<Awaited<ReturnType<typeof loadDccList>>>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;

    loadDccList()
      .then((items) => {
        if (!cancelled) {
          setDccItems(items);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDccItems([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = query.trim()
    ? dccItems
        .filter((item) => {
          const haystack = [
            `${item.deptNum}.${item.classNum ?? ""}.${item.catNum ?? ""}`,
            item.deptName,
            item.className,
            item.catName,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return haystack.includes(query.trim().toLowerCase());
        })
        .slice(0, 12)
    : dccItems.slice(0, 12);

  const dccIdByKey = new Map(
    (refs?.dccs ?? []).map((row) => [buildDccLookupKey(row), row.dccId]),
  );

  function commitQuery() {
    const match = findCommittedDccMatch(dccItems, query);
    if (!match) {
      if (query.trim()) {
        toast.error("Choose a valid DCC from the existing catalog lookup.");
      }
      return;
    }

    const dccId = dccIdByKey.get(buildDccLookupKey(match));
    if (!dccId || selectedIds.includes(dccId)) {
      setQuery("");
      return;
    }

    onChange([...selectedIds, dccId]);
    setQuery("");
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="quick-pick-dccs">DCCs</Label>
      <Input
        id="quick-pick-dccs"
        list="quick-pick-dccs-list"
        placeholder="10.10.20 or drinks"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onBlur={commitQuery}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commitQuery();
          }
        }}
      />
      <p className="text-xs text-muted-foreground">
        Filters by department, class, and category so related catalog groups appear together.
      </p>
      <datalist id="quick-pick-dccs-list">
        {filtered.map((item) => (
          <option
            key={buildDccLookupKey(item)}
            value={`${item.deptNum}.${item.classNum ?? ""}.${item.catNum ?? ""}`}
          >
            {[item.deptName, item.className, item.catName].filter(Boolean).join(" › ")}
          </option>
        ))}
      </datalist>
      {selectedIds.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selectedIds.map((dccId) => (
            <RemovableChip
              key={dccId}
              label={lookups.dccLabels.get(dccId) ?? `DCC #${dccId}`}
              onRemove={() => onChange(selectedIds.filter((value) => value !== dccId))}
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No DCCs selected.</p>
      )}
    </div>
  );
}

function SkuSearchAddField({
  selectedSkus,
  showSelectedHandoffNote = false,
  onChange,
}: {
  selectedSkus: number[];
  showSelectedHandoffNote?: boolean;
  onChange: (next: number[]) => void;
}) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [results, setResults] = useState<QuickPickSectionPreviewProduct[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const search = deferredQuery.trim();
    if (!search) {
      setResults([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    Promise.all([
      searchProducts({ ...EMPTY_FILTERS, tab: "textbooks", search }),
      searchProducts({ ...EMPTY_FILTERS, tab: "merchandise", search }),
    ])
      .then(([textbooks, merchandise]) => {
        if (cancelled) return;

        const merged = new Map<number, QuickPickSectionPreviewProduct>();
        for (const product of [...textbooks.products, ...merchandise.products]) {
          if (merged.has(product.sku)) continue;
          merged.set(product.sku, {
            sku: product.sku,
            itemType: product.item_type,
            title: product.title,
            description: product.description,
            catalogNumber: product.catalog_number,
            author: product.author,
            isbn: product.isbn,
            edition: product.edition,
            discontinued: product.discontinued,
          });
        }

        setResults(Array.from(merged.values()).slice(0, 12));
      })
      .catch(() => {
        if (!cancelled) {
          setResults([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [deferredQuery]);

  function addSku(sku: number) {
    if (selectedSkus.includes(sku)) {
      setQuery("");
      return;
    }
    onChange([...selectedSkus, sku]);
    setQuery("");
    setResults([]);
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="quick-pick-explicit-skus">Explicit SKUs</Label>
      <p className="text-xs text-muted-foreground">
        Pins exact selected products into this Quick Pick section, even if they do not match another rule.
      </p>
      {showSelectedHandoffNote ? (
        <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          These selected products will be included directly in this Quick Pick section.
        </p>
      ) : null}
      <Input
        id="quick-pick-explicit-skus"
        placeholder="Search the product catalog by title, description, ISBN, barcode, or SKU"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {loading ? (
        <p className="text-xs text-muted-foreground">Searching catalog…</p>
      ) : null}
      {results.length > 0 ? (
        <div className="rounded-lg border border-border">
          <ul className="divide-y">
            {results.map((result) => (
              <li key={result.sku}>
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left hover:bg-muted/50"
                  onClick={() => addSku(result.sku)}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      #{result.sku} · {getRowTitle(result) || "Untitled"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {result.catalogNumber ? `Cat# ${result.catalogNumber}` : formatItemTypeLabel(result.itemType)}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">Add</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {selectedSkus.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selectedSkus.map((sku) => (
            <RemovableChip
              key={sku}
              label={`SKU ${sku}`}
              onRemove={() => onChange(selectedSkus.filter((value) => value !== sku))}
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No explicit SKUs selected.</p>
      )}
    </div>
  );
}

type QuickPickSectionsPanelProps = {
  initialExplicitSkus?: number[];
  canCreateGlobal?: boolean;
  currentUserId?: string | null;
};

export function QuickPickSectionsPanel({
  initialExplicitSkus = [],
  canCreateGlobal = true,
  currentUserId = null,
}: QuickPickSectionsPanelProps = {}) {
  const [sections, setSections] = useState<QuickPickSectionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editingSection, setEditingSection] = useState<QuickPickSectionDto | null>(null);
  const [form, setForm] = useState<QuickPickSectionFormValues>({ ...EMPTY_FORM });
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [selectedSkuHandoffActive, setSelectedSkuHandoffActive] = useState(false);
  const [slugDirty, setSlugDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [preview, setPreview] = useState<QuickPickSectionPreviewResult>(EMPTY_PREVIEW);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const appliedInitialExplicitSkuKeyRef = useRef<string | null>(null);

  const previewInput: QuickPickSectionScopeInput = {
    descriptionLike: form.descriptionLike,
    dccIds: form.dccIds,
    vendorIds: form.vendorIds,
    itemType: form.itemType,
    explicitSkus: form.explicitSkus,
    includeDiscontinued: form.includeDiscontinued,
  };
  const previewKey = JSON.stringify(previewInput);
  const scopeIsEmpty = isEmptyScope(previewInput);
  const scopeRuleSummary = buildScopeRuleSummary(previewInput);
  const availabilityModifiers = form.includeDiscontinued ? ["Includes discontinued"] : [];
  const scopeRuleCount = countPopulatedScopeFields(previewInput);
  const itemTypeTriggerLabel = form.itemType
    ? formatItemTypeLabel(form.itemType)
    : "Any item type";
  const selectedIconName = form.icon || "Package2";
  const editingSectionStartedEmpty = editingSection ? isEmptyScope(scopeInputFromSection(editingSection)) : false;
  const canSaveLegacyEmptyScope = mode === "edit" && scopeIsEmpty && editingSectionStartedEmpty;
  const saveDisabled = saving || form.name.trim() === "" || (scopeIsEmpty && !canSaveLegacyEmptyScope);

  function canManageSection(section: QuickPickSectionDto): boolean {
    return canCreateGlobal
      || (
        currentUserId != null
        && section.createdByUserId === currentUserId
        && !section.isGlobal
      );
  }

  async function loadSections() {
    setLoading(true);
    try {
      const items = await quickPickSectionsApi.listQuickPickSections();
      setSections(sortSections(items));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load quick pick sections.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSections();
  }, []);

  const openCreateDialog = useCallback((prefillExplicitSkus: number[] = []) => {
    setMode("create");
    setEditingSection(null);
    setForm({
      ...EMPTY_FORM,
      isGlobal: canCreateGlobal,
      explicitSkus: normalizeExplicitSkus(prefillExplicitSkus),
    });
    setAdvancedOpen(false);
    setSelectedSkuHandoffActive(prefillExplicitSkus.length > 0);
    setSlugDirty(false);
    setSaveError(null);
    setPreview(EMPTY_PREVIEW);
    setPreviewError(null);
    setDialogOpen(true);
  }, [canCreateGlobal]);

  useEffect(() => {
    const initialKey = initialExplicitSkus.join(",");
    if (initialKey === "") {
      appliedInitialExplicitSkuKeyRef.current = null;
      return;
    }

    if (dialogOpen || appliedInitialExplicitSkuKeyRef.current === initialKey) {
      return;
    }

    appliedInitialExplicitSkuKeyRef.current = initialKey;
    openCreateDialog(initialExplicitSkus);
  }, [dialogOpen, initialExplicitSkus, openCreateDialog]);

  useEffect(() => {
    const parsedPreviewInput = JSON.parse(previewKey) as QuickPickSectionScopeInput;

    if (!dialogOpen) {
      setPreviewLoading(false);
      return;
    }

    if (isEmptyScope(parsedPreviewInput)) {
      setPreview(EMPTY_PREVIEW);
      setPreviewLoading(false);
      setPreviewError(null);
      return;
    }

    let cancelled = false;
    setPreviewError(null);
    const timer = window.setTimeout(() => {
      setPreviewLoading(true);

      quickPickSectionsApi
        .previewQuickPickSection(parsedPreviewInput)
        .then((result) => {
          if (!cancelled) {
            setPreview(result);
          }
        })
        .catch((error) => {
          if (!cancelled) {
            setPreview(EMPTY_PREVIEW);
            setPreviewError(
              error instanceof Error ? error.message : "Failed to preview matching products.",
            );
          }
        })
        .finally(() => {
          if (!cancelled) {
            setPreviewLoading(false);
          }
        });
    }, PREVIEW_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [dialogOpen, previewKey]);

  function openEditDialog(section: QuickPickSectionDto) {
    setMode("edit");
    setEditingSection(section);
    setForm(buildFormValues(section));
    setAdvancedOpen(false);
    setSelectedSkuHandoffActive(false);
    setSlugDirty(true);
    setSaveError(null);
    setPreview({
      isEmpty: false,
      productCount: section.productCount,
      products: [],
    });
    setPreviewError(null);
    setDialogOpen(true);
  }

  function closeDialog(nextOpen: boolean) {
    setDialogOpen(nextOpen);
    if (!nextOpen) {
      setSaveError(null);
      setPreviewError(null);
      setPreview(EMPTY_PREVIEW);
      setPreviewLoading(false);
    }
  }

  function updateForm<K extends keyof QuickPickSectionFormValues>(
    key: K,
    value: QuickPickSectionFormValues[K],
  ) {
    setForm((current) => {
      const next = {
        ...current,
        [key]: value,
      };

      if (key === "name" && !slugDirty) {
        const slug = String(value)
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
        next.slug = slug;
      }

      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);

    try {
      if (mode === "create") {
        await quickPickSectionsApi.createQuickPickSection(form);
        toast.success("Quick pick section created.");
      } else if (editingSection) {
        await quickPickSectionsApi.updateQuickPickSection(editingSection.id, form);
        toast.success("Quick pick section updated.");
      }

      setDialogOpen(false);
      await loadSections();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to save quick pick section.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(section: QuickPickSectionDto) {
    if (!window.confirm(`Delete "${section.name}"?`)) {
      return;
    }

    try {
      await quickPickSectionsApi.deleteQuickPickSection(section.id);
      setSections((current) => current.filter((item) => item.id !== section.id));
      toast.success("Quick pick section deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete quick pick section.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quick Pick Sections</h1>
          <p className="text-sm text-muted-foreground">
            Configure the sections shown in the Product Catalog quick picks panel.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => openCreateDialog()}>
          Create Section
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configured Sections</CardTitle>
          <CardDescription>
            Shared sections are readable by every signed-in user. Personal sections are only editable by their creator.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-6 text-sm text-muted-foreground">Loading quick pick sections…</p>
          ) : sections.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">
              No quick pick sections exist yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Products</TableHead>
                  <TableHead>Display order</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sections.map((section) => (
                  <TableRow key={section.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <IconSwatch name={section.icon ?? "Package2"} />
                        <div>
                          <div className="font-medium">{section.name}</div>
                          {section.description ? (
                            <div className="text-xs text-muted-foreground">{section.description}</div>
                          ) : null}
                          {!section.isGlobal ? (
                            <div className="text-xs text-muted-foreground">Personal section</div>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xl text-sm text-muted-foreground">
                      {section.scopeSummary}
                    </TableCell>
                    <TableCell>{section.productCount.toLocaleString()}</TableCell>
                    <TableCell>{section.sortOrder}</TableCell>
                    <TableCell className="text-right">
                      {canManageSection(section) ? (
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEditDialog(section)}>
                            Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(section)}
                          >
                            Delete
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Shared</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={closeDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto p-0 sm:max-w-3xl lg:max-w-5xl xl:max-w-6xl">
          <DialogHeader className="border-b border-border px-6 py-5">
            <DialogTitle>{mode === "create" ? "Create quick pick section" : "Edit quick pick section"}</DialogTitle>
            <DialogDescription>
              Choose the products that belong together, then save them as a reusable catalog shortcut.
            </DialogDescription>
          </DialogHeader>

          <div
            data-testid="quick-pick-editor-grid"
            className="grid items-start gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(380px,0.95fr)] xl:gap-8"
          >
            <div className="space-y-6">
              <div
                data-testid="quick-pick-basics-grid"
                className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]"
              >
                <Card size="sm" className="border border-border/60 bg-background/95">
                  <CardHeader className="space-y-1.5 border-b border-border/50 bg-muted/[0.12]">
                    <CardTitle>Section details</CardTitle>
                    <CardDescription>
                      Set the label and icon people will see in the quick picks list.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 pt-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="quick-pick-name">Name</Label>
                      <Input
                        id="quick-pick-name"
                        value={form.name}
                        onChange={(event) => updateForm("name", event.target.value)}
                        placeholder="CopyTech Services"
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="quick-pick-description">Description</Label>
                      <Textarea
                        id="quick-pick-description"
                        value={form.description}
                        onChange={(event) => updateForm("description", event.target.value)}
                        placeholder="Optional note about when to use this section."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="quick-pick-icon">Icon</Label>
                      <Select
                        value={selectedIconName}
                        onValueChange={(value) => updateForm("icon", value as QuickPickSectionFormValues["icon"])}
                      >
                        <SelectTrigger id="quick-pick-icon" className="w-full">
                          <SelectValue>
                            <IconSelectLabel name={selectedIconName} />
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {QUICK_PICK_SECTION_ICON_NAMES.map((iconName) => (
                            <SelectItem key={iconName} value={iconName}>
                              <IconSelectLabel name={iconName} />
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="quick-pick-sort-order">Display order</Label>
                      <Input
                        id="quick-pick-sort-order"
                        type="number"
                        value={form.sortOrder}
                        onChange={(event) => updateForm("sortOrder", Number(event.target.value) || 0)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Lower numbers appear first. Leave as 0 unless you want this section before or after others.
                      </p>
                    </div>
                    <div className="space-y-3 sm:col-span-2">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-md px-1 py-1 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-expanded={advancedOpen}
                        onClick={() => setAdvancedOpen((open) => !open)}
                      >
                        {advancedOpen ? (
                          <ChevronDownIcon className="size-4" aria-hidden="true" />
                        ) : (
                          <ChevronRightIcon className="size-4" aria-hidden="true" />
                        )}
                        Advanced
                      </button>
                      {advancedOpen ? (
                        <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
                          <Label htmlFor="quick-pick-slug">URL/internal ID</Label>
                          <Input
                            id="quick-pick-slug"
                            value={form.slug}
                            onChange={(event) => {
                              setSlugDirty(true);
                              updateForm("slug", event.target.value);
                            }}
                            placeholder="copytech-services"
                          />
                          <p className="text-xs text-muted-foreground">
                            Mostly used for direct links and support. It is filled in from the name automatically.
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>

                <Card size="sm" className="border border-border/60 bg-muted/[0.18]">
                  <CardHeader className="space-y-1.5 border-b border-border/50 bg-background/80">
                    <CardTitle>Availability</CardTitle>
                    <CardDescription>
                      Control who can see the section and whether discontinued items can still match.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 pt-4 sm:grid-cols-2 xl:grid-cols-1">
                    {canCreateGlobal ? (
                      <div className="flex items-start gap-3 rounded-xl border border-border bg-background/80 px-4 py-3 text-sm">
                        <Checkbox
                          id="quick-pick-global-section"
                          checked={form.isGlobal}
                          onCheckedChange={(checked) => updateForm("isGlobal", checked === true)}
                          aria-describedby="quick-pick-global-section-description"
                        />
                        <div className="space-y-1">
                          <label htmlFor="quick-pick-global-section" className="block cursor-pointer font-medium text-foreground">
                            Shared section
                          </label>
                          <p id="quick-pick-global-section-description" className="text-muted-foreground">
                            Visible to every signed-in user.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-border bg-background/80 px-4 py-3 text-sm">
                        <p className="font-medium text-foreground">Personal section</p>
                        <p className="mt-1 text-muted-foreground">
                          Only you can manage this section. Shared Quick Picks from admins still appear in the catalog.
                        </p>
                      </div>
                    )}
                    <div className="flex items-start gap-3 rounded-xl border border-border bg-background/80 px-4 py-3 text-sm">
                      <Checkbox
                        id="quick-pick-include-discontinued"
                        checked={form.includeDiscontinued}
                        onCheckedChange={(checked) => updateForm("includeDiscontinued", checked === true)}
                        aria-describedby="quick-pick-include-discontinued-description"
                      />
                      <div className="space-y-1">
                        <label htmlFor="quick-pick-include-discontinued" className="block cursor-pointer font-medium text-foreground">
                          Include discontinued products
                        </label>
                        <p id="quick-pick-include-discontinued-description" className="text-muted-foreground">
                          Keep old or retired catalog rows eligible for matching.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="border border-border/70 bg-gradient-to-b from-background to-muted/[0.18] shadow-[0_6px_24px_oklch(0.3_0.02_60_/_0.08),0_2px_8px_oklch(0.3_0.02_60_/_0.04)]">
                <CardHeader className="space-y-2 border-b border-border/60 bg-muted/[0.18]">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle>Scope builder</CardTitle>
                      <CardDescription>
                        Matching uses OR logic across every populated rule. Add at least one rule to enable save.
                      </CardDescription>
                    </div>
                    <Badge variant={scopeRuleCount > 0 ? "secondary" : "outline"} className="rounded-full px-3 py-1 text-xs font-medium">
                      {scopeRuleCount} {scopeRuleCount === 1 ? "rule" : "rules"} active
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5 pt-5">
                  <div className="rounded-xl border border-dashed border-border bg-background/80 px-4 py-3 shadow-sm">
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                      Current configuration
                    </p>
                    {scopeRuleSummary.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {scopeRuleSummary.map((label) => (
                          <Badge key={label} variant="secondary" className="rounded-full px-3 py-1 text-xs font-medium">
                            {label}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">
                        No matching rules yet. The section stays disabled until at least one scope field is populated.
                      </p>
                    )}
                    {availabilityModifiers.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                          Availability modifier
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {availabilityModifiers.map((label) => (
                            <Badge key={label} variant="outline" className="rounded-full px-3 py-1 text-xs font-medium">
                              {label}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-2 lg:col-span-2">
                      <Label htmlFor="quick-pick-description-like">Product description contains</Label>
                      <Input
                        id="quick-pick-description-like"
                        value={form.descriptionLike}
                        onChange={(event) => updateForm("descriptionLike", event.target.value)}
                        placeholder="CT or copy"
                      />
                      <p className="text-xs text-muted-foreground">
                        Finds words or codes inside product descriptions, such as CT or copy.
                      </p>
                    </div>

                    <div className="lg:col-span-2">
                      <DccMultiSelect
                        selectedIds={form.dccIds}
                        onChange={(next) => updateForm("dccIds", next)}
                      />
                    </div>

                    <div className="lg:col-span-2">
                      <VendorMultiSelect
                        selectedIds={form.vendorIds}
                        onChange={(next) => updateForm("vendorIds", next)}
                      />
                    </div>

                    <div className="space-y-2 lg:col-span-2">
                      <Label htmlFor="quick-pick-item-type">Item type</Label>
                      <Select
                        value={form.itemType || "__any__"}
                        onValueChange={(value) =>
                          updateForm("itemType", value === "__any__" ? "" : value as QuickPickSectionFormValues["itemType"])
                        }
                      >
                        <SelectTrigger id="quick-pick-item-type" className="w-full bg-background/90">
                          <SelectValue placeholder="Any item type">
                            {itemTypeTriggerLabel}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__any__">Any item type</SelectItem>
                          {QUICK_PICK_SECTION_ITEM_TYPE_OPTIONS.map((itemType) => (
                            <SelectItem key={itemType} value={itemType}>
                              {formatItemTypeLabel(itemType)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="lg:col-span-2">
                      <SkuSearchAddField
                        selectedSkus={form.explicitSkus}
                        showSelectedHandoffNote={selectedSkuHandoffActive}
                        onChange={(next) => updateForm("explicitSkus", next)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4 lg:sticky lg:top-6">
              <Card size="sm" className="h-fit overflow-hidden">
                <CardHeader className="space-y-3 border-b border-border bg-muted/20">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle>Live preview</CardTitle>
                      <CardDescription>
                        Review the current match count and the first 20 catalog rows before saving.
                      </CardDescription>
                    </div>
                    <Badge variant={scopeIsEmpty ? "outline" : "secondary"} className="rounded-full px-3 py-1 text-xs font-medium">
                      {scopeIsEmpty ? "Disabled until scoped" : "Preview active"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 p-5">
                  <div aria-live="polite" className="rounded-xl border border-border bg-background px-4 py-4">
                    {scopeIsEmpty ? (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">0 products match — chip will be disabled</p>
                        <p className="text-sm text-muted-foreground">
                          Add a description pattern, DCC, vendor, item type, or explicit SKU to start previewing matches.
                        </p>
                      </div>
                    ) : previewLoading ? (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Recounting matching products…</p>
                        <p className="text-sm text-muted-foreground">
                          Updating the preview with your latest scope changes.
                        </p>
                      </div>
                    ) : previewError ? (
                      <p className="text-sm text-destructive">{previewError}</p>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-2xl font-semibold tracking-tight">
                          {preview.productCount.toLocaleString()}
                        </p>
                        <p className="text-sm text-muted-foreground">products currently match this section</p>
                      </div>
                    )}
                  </div>

                  {!scopeIsEmpty && !previewLoading && !previewError ? (
                    preview.products.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                        No example rows matched.
                      </div>
                    ) : (
                      <div className="rounded-xl border border-border">
                        <div className="border-b border-border px-4 py-3 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                          Example matches
                        </div>
                        <ul className="max-h-[420px] divide-y overflow-y-auto">
                          {preview.products.map((product) => (
                            <li key={product.sku} className="space-y-1 px-4 py-3">
                              <div className="text-sm font-medium">
                                #{product.sku} · {getRowTitle(product) || "Untitled"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {product.catalogNumber
                                  ? `Cat# ${product.catalogNumber}`
                                  : formatItemTypeLabel(product.itemType)}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  ) : null}
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="border-t border-border px-6 py-5">
            {saveError ? <p className="mb-4 text-sm text-destructive">{saveError}</p> : null}

            <DialogFooter className="items-center gap-3 sm:justify-between">
              <p id="quick-pick-save-hint" className="text-sm text-muted-foreground">
                {scopeIsEmpty
                  ? canSaveLegacyEmptyScope
                    ? "Legacy empty-scope sections can still be updated, but they stay disabled in quick picks until a scope rule is added."
                    : mode === "edit"
                      ? "Add at least one scope rule to keep this section active. Legacy empty-scope sections can still be updated, but scoped sections cannot be saved empty."
                      : "Add at least one scope rule to enable save."
                  : "This section will be enabled as soon as it has a name and at least one scope rule."}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saveDisabled}
                  aria-describedby="quick-pick-save-hint"
                >
                  {saving ? "Saving…" : mode === "create" ? "Create section" : "Save changes"}
                </Button>
              </div>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
