"use client";

import { useDeferredValue, useEffect, useRef, useState } from "react";
import {
  BadgePercentIcon,
  BookOpenIcon,
  ClipboardListIcon,
  GraduationCapIcon,
  Package2Icon,
  PrinterIcon,
  ShoppingBagIcon,
  SparklesIcon,
  StarIcon,
  TagsIcon,
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
  GraduationCap: GraduationCapIcon,
  ShoppingBag: ShoppingBagIcon,
  Tags: TagsIcon,
  ClipboardList: ClipboardListIcon,
  Wrench: WrenchIcon,
  Sparkles: SparklesIcon,
  Star: StarIcon,
  BadgePercent: BadgePercentIcon,
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
    chips.push(`Description like ${scope.descriptionLike.trim()}`);
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
  onChange,
}: {
  selectedSkus: number[];
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

export function QuickPickSectionsPanel({ initialExplicitSkus = [] }: { initialExplicitSkus?: number[] } = {}) {
  const [sections, setSections] = useState<QuickPickSectionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editingSection, setEditingSection] = useState<QuickPickSectionDto | null>(null);
  const [form, setForm] = useState<QuickPickSectionFormValues>({ ...EMPTY_FORM });
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
  }, [dialogOpen, initialExplicitSkus]);

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

  function openCreateDialog(prefillExplicitSkus: number[] = []) {
    setMode("create");
    setEditingSection(null);
    setForm({
      ...EMPTY_FORM,
      explicitSkus: normalizeExplicitSkus(prefillExplicitSkus),
    });
    setSlugDirty(false);
    setSaveError(null);
    setPreview(EMPTY_PREVIEW);
    setPreviewError(null);
    setDialogOpen(true);
  }

  function openEditDialog(section: QuickPickSectionDto) {
    setMode("edit");
    setEditingSection(section);
    setForm(buildFormValues(section));
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
            Configure the sections Marcos will use in the Product Catalog quick picks panel.
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
            Global sections are readable by every signed-in user. Icons come from a curated lucide subset.
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
                  <TableHead>Sort order</TableHead>
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
                          <div className="text-xs text-muted-foreground">{section.slug}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xl text-sm text-muted-foreground">
                      {section.scopeSummary}
                    </TableCell>
                    <TableCell>{section.productCount.toLocaleString()}</TableCell>
                    <TableCell>{section.sortOrder}</TableCell>
                    <TableCell className="text-right">
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
              Scope fields combine into one OR predicate. New sections need at least one scope rule, while legacy empty-scope sections can still be edited.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(360px,0.9fr)]">
            <div className="space-y-5">
              <Card>
                <CardHeader className="space-y-1">
                  <CardTitle>Section details</CardTitle>
                  <CardDescription>
                    Set the label, icon, and admin-only metadata shown in the quick picks list.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="quick-pick-name">Name</Label>
                    <Input
                      id="quick-pick-name"
                      value={form.name}
                      onChange={(event) => updateForm("name", event.target.value)}
                      placeholder="CopyTech Services"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quick-pick-slug">Slug</Label>
                    <Input
                      id="quick-pick-slug"
                      value={form.slug}
                      onChange={(event) => {
                        setSlugDirty(true);
                        updateForm("slug", event.target.value);
                      }}
                      placeholder="copytech-services"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="quick-pick-description">Description</Label>
                    <Textarea
                      id="quick-pick-description"
                      value={form.description}
                      onChange={(event) => updateForm("description", event.target.value)}
                      placeholder="Optional help text for admins."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quick-pick-icon">Icon</Label>
                    <Select
                      value={selectedIconName}
                      onValueChange={(value) => updateForm("icon", value as QuickPickSectionFormValues["icon"])}
                    >
                      <SelectTrigger id="quick-pick-icon" className="w-full">
                        <SelectValue>{formatIconLabel(selectedIconName)}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {QUICK_PICK_SECTION_ICON_NAMES.map((iconName) => (
                          <SelectItem key={iconName} value={iconName}>
                            {formatIconLabel(iconName)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quick-pick-sort-order">Sort order</Label>
                    <Input
                      id="quick-pick-sort-order"
                      type="number"
                      value={form.sortOrder}
                      onChange={(event) => updateForm("sortOrder", Number(event.target.value) || 0)}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="space-y-1">
                  <CardTitle>Availability</CardTitle>
                  <CardDescription>
                    Control who can see the section and whether discontinued items can still match.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  <div className="flex items-start gap-3 rounded-xl border border-border px-4 py-3 text-sm">
                    <Checkbox
                      id="quick-pick-global-section"
                      checked={form.isGlobal}
                      onCheckedChange={(checked) => updateForm("isGlobal", checked === true)}
                      aria-describedby="quick-pick-global-section-description"
                    />
                    <div className="space-y-1">
                      <label htmlFor="quick-pick-global-section" className="block cursor-pointer font-medium text-foreground">
                        Global section
                      </label>
                      <p id="quick-pick-global-section-description" className="text-muted-foreground">
                        Visible to every signed-in user.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-xl border border-border px-4 py-3 text-sm">
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

              <Card>
                <CardHeader className="space-y-1">
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
                <CardContent className="space-y-4">
                  <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3">
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
                      <Label htmlFor="quick-pick-description-like">Description like</Label>
                      <Input
                        id="quick-pick-description-like"
                        value={form.descriptionLike}
                        onChange={(event) => updateForm("descriptionLike", event.target.value)}
                        placeholder='ILIKE example: CT %'
                      />
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
                        <SelectTrigger id="quick-pick-item-type" className="w-full">
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
                        onChange={(next) => updateForm("explicitSkus", next)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-5 lg:sticky lg:top-0">
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
