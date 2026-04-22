"use client";

import { useDeferredValue, useEffect, useState } from "react";
import {
  BadgePercentIcon,
  BookOpenIcon,
  ClipboardListIcon,
  GraduationCapIcon,
  Package2Icon,
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
} from "@/domains/quick-pick-sections/types";

const ICON_COMPONENTS = {
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

function isEmptyScope(form: QuickPickSectionFormValues): boolean {
  return (
    form.descriptionLike.trim() === ""
    && form.dccIds.length === 0
    && form.vendorIds.length === 0
    && form.itemType === ""
    && form.explicitSkus.length === 0
  );
}

function formatItemTypeLabel(value: string): string {
  return value
    .split("_")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function getRowTitle(product: QuickPickSectionPreviewProduct): string {
  return product.itemType === "textbook"
    ? (product.title ?? product.description ?? "")
    : (product.description ?? product.title ?? "");
}

function IconSwatch({ name }: { name: QuickPickSectionFormValues["icon"] }) {
  const Icon = name ? ICON_COMPONENTS[name] : Package2Icon;
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

export function QuickPickSectionsPanel() {
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

  const previewInput = {
    descriptionLike: form.descriptionLike,
    dccIds: form.dccIds,
    vendorIds: form.vendorIds,
    itemType: form.itemType,
    explicitSkus: form.explicitSkus,
    includeDiscontinued: form.includeDiscontinued,
  };
  const deferredPreviewKey = useDeferredValue(JSON.stringify(previewInput));

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
    if (!dialogOpen) {
      return;
    }

    if (isEmptyScope(form)) {
      setPreview(EMPTY_PREVIEW);
      setPreviewLoading(false);
      setPreviewError(null);
      return;
    }

    let cancelled = false;
    setPreviewLoading(true);
    setPreviewError(null);

    quickPickSectionsApi
      .previewQuickPickSection(JSON.parse(deferredPreviewKey) as typeof previewInput)
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

    return () => {
      cancelled = true;
    };
  }, [dialogOpen, deferredPreviewKey, form]);

  function openCreateDialog() {
    setMode("create");
    setEditingSection(null);
    setForm({ ...EMPTY_FORM });
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
        <Button onClick={openCreateDialog}>Create Section</Button>
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
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "Create quick pick section" : "Edit quick pick section"}</DialogTitle>
            <DialogDescription>
              Scope fields combine into one OR predicate. Leaving the scope empty disables the chip.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
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
                    value={form.icon || "Package2"}
                    onValueChange={(value) => updateForm("icon", value as QuickPickSectionFormValues["icon"])}
                  >
                    <SelectTrigger id="quick-pick-icon" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {QUICK_PICK_SECTION_ICON_NAMES.map((iconName) => (
                        <SelectItem key={iconName} value={iconName}>
                          {iconName}
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
              </div>

              <div className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.isGlobal}
                    onChange={(event) => updateForm("isGlobal", event.target.checked)}
                  />
                  Global section
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.includeDiscontinued}
                    onChange={(event) => updateForm("includeDiscontinued", event.target.checked)}
                  />
                  Include discontinued products
                </label>
              </div>

              <div className="space-y-4 rounded-xl border border-border p-4">
                <div>
                  <h2 className="text-sm font-semibold">Scope builder</h2>
                  <p className="text-xs text-muted-foreground">
                    Matching uses OR logic across each populated scope field.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quick-pick-description-like">Description like</Label>
                  <Input
                    id="quick-pick-description-like"
                    value={form.descriptionLike}
                    onChange={(event) => updateForm("descriptionLike", event.target.value)}
                    placeholder='ILIKE example: CT %'
                  />
                </div>

                <DccMultiSelect
                  selectedIds={form.dccIds}
                  onChange={(next) => updateForm("dccIds", next)}
                />

                <VendorMultiSelect
                  selectedIds={form.vendorIds}
                  onChange={(next) => updateForm("vendorIds", next)}
                />

                <div className="space-y-2">
                  <Label htmlFor="quick-pick-item-type">Item type</Label>
                  <Select
                    value={form.itemType || "__any__"}
                    onValueChange={(value) =>
                      updateForm("itemType", value === "__any__" ? "" : value as QuickPickSectionFormValues["itemType"])
                    }
                  >
                    <SelectTrigger id="quick-pick-item-type" className="w-full">
                      <SelectValue />
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

                <SkuSearchAddField
                  selectedSkus={form.explicitSkus}
                  onChange={(next) => updateForm("explicitSkus", next)}
                />
              </div>
            </div>

            <Card size="sm" className="h-fit">
              <CardHeader>
                <CardTitle>Live Preview</CardTitle>
                <CardDescription>
                  The preview shows the current match count and the first 20 catalog rows.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {isEmptyScope(form) ? (
                  <p className="text-sm text-muted-foreground">
                    0 products match — chip will be disabled
                  </p>
                ) : previewLoading ? (
                  <p className="text-sm text-muted-foreground">Recounting matching products…</p>
                ) : previewError ? (
                  <p className="text-sm text-destructive">{previewError}</p>
                ) : (
                  <>
                    <p className="text-sm font-medium">
                      {preview.productCount.toLocaleString()} products currently match
                    </p>
                    {preview.products.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No example rows matched.</p>
                    ) : (
                      <div className="rounded-lg border border-border">
                        <ul className="divide-y">
                          {preview.products.map((product) => (
                            <li key={product.sku} className="px-3 py-2">
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
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {saveError ? <p className="text-sm text-destructive">{saveError}</p> : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || form.name.trim() === ""}
            >
              {saving ? "Saving…" : mode === "create" ? "Create section" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
