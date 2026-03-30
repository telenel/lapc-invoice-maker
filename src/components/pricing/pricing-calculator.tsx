"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CopyIcon,
  FilePlus2Icon,
  PrinterIcon,
  RefreshCcwIcon,
  ScanLineIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { printPricingApi } from "@/domains/print-pricing/api-client";
import type { PrintEstimateInput, PrintPricingSnapshot } from "@/domains/print-pricing/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  calculatePrintShopQuote,
  centsToCurrency,
  percentBasisPointsToLabel,
  selectQuantityTier,
  type BindingType,
  type CopyMode,
  type CopySides,
  type PosterSaturation,
} from "@/lib/pricing/print-shop-pricing";

interface PricingCalculatorProps {
  pricing: PrintPricingSnapshot;
}

interface EstimateListItem {
  id: string;
  item: PrintEstimateInput;
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function parsePositiveInteger(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return parsed > 0 ? parsed : null;
}

function buildEstimateSummaryText(
  pricing: PrintPricingSnapshot,
  items: EstimateListItem[]
): string {
  if (items.length === 0) {
    return "No services added yet.";
  }

  const calculated = calculatePrintShopQuote(
    items.map((entry) => entry.item),
    pricing
  );

  const lines = calculated.lineItems.map(
    (item) => `- ${item.description}: ${item.quantity} x ${centsToCurrency(item.effectiveUnitPriceCents)} = ${centsToCurrency(item.lineTotalCents)}`
  );

  return [
    `${pricing.shopTitle} estimate`,
    "",
    ...lines,
    "",
    `Subtotal: ${centsToCurrency(calculated.subtotalCents)}`,
    calculated.taxEnabled
      ? `Tax (${percentBasisPointsToLabel(calculated.taxRateBasisPoints)}): ${centsToCurrency(calculated.taxCents)}`
      : "Tax: Not applied",
    `Total: ${centsToCurrency(calculated.totalCents)}`,
    "",
    pricing.quoteDisclaimer,
  ].join("\n");
}

function CopyTierPreview({
  pricing,
  mode,
  totalPages,
  quantitySets,
  sides,
}: {
  pricing: PrintPricingSnapshot;
  mode: CopyMode;
  totalPages: string;
  quantitySets: string;
  sides: CopySides;
}) {
  const parsedPages = parsePositiveInteger(totalPages);
  const parsedSets = parsePositiveInteger(quantitySets) ?? 1;

  if (!parsedPages) {
    return <p className="text-xs text-muted-foreground">Enter page count to preview the copy tier.</p>;
  }

  const totalBillablePages = parsedPages * parsedSets;
  const tier = selectQuantityTier(pricing.copyTiers[mode], totalBillablePages);
  const multiplier =
    mode === "BW"
      ? pricing.bwDuplexMultiplierBasisPoints
      : pricing.colorDuplexMultiplierBasisPoints;
  const effectiveUnitCents =
    sides === "DOUBLE"
      ? Math.round((tier.unitPriceCents * multiplier) / 10_000)
      : tier.unitPriceCents;

  return (
    <div className="rounded-lg border border-border/80 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
      <div className="font-medium text-foreground">Selected tier: {tier.label}</div>
      <div className="mt-1">
        Billable pages: {totalBillablePages}. Effective price: {centsToCurrency(effectiveUnitCents)} per page
        {sides === "DOUBLE" ? " after duplex pricing." : "."}
      </div>
    </div>
  );
}

function ScanTierPreview({
  pricing,
  pages,
}: {
  pricing: PrintPricingSnapshot;
  pages: string;
}) {
  const parsedPages = parsePositiveInteger(pages);

  if (!parsedPages) {
    return <p className="text-xs text-muted-foreground">Enter page count to preview scanning pricing.</p>;
  }

  const tier = selectQuantityTier(pricing.scanTiers, parsedPages);
  const rawTotal = tier.unitPriceCents * parsedPages;
  const finalTotal = Math.max(rawTotal, pricing.minimumScanChargeCents);

  return (
    <div className="rounded-lg border border-border/80 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
      <div className="font-medium text-foreground">Selected tier: {tier.label}</div>
      <div className="mt-1">
        {centsToCurrency(tier.unitPriceCents)} per page. Estimated line total: {centsToCurrency(finalTotal)}
        {finalTotal !== rawTotal ? ` with the ${centsToCurrency(pricing.minimumScanChargeCents)} minimum applied.` : "."}
      </div>
    </div>
  );
}

function ServiceCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <Card className="h-full border border-border/70 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
      <CardFooter>{footer}</CardFooter>
    </Card>
  );
}

export function PricingCalculator({ pricing }: PricingCalculatorProps) {
  const [estimateItems, setEstimateItems] = useState<EstimateListItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const [copyMode, setCopyMode] = useState<CopyMode>("BW");
  const [copySides, setCopySides] = useState<CopySides>("SINGLE");
  const [copyPages, setCopyPages] = useState("");
  const [copySets, setCopySets] = useState("1");

  const [posterQuantity, setPosterQuantity] = useState("1");
  const [posterSaturation, setPosterSaturation] = useState<PosterSaturation>("LOW");
  const [posterNotes, setPosterNotes] = useState("");

  const [bindingType, setBindingType] = useState<BindingType>("COMB");
  const [bindingQuantity, setBindingQuantity] = useState("1");

  const [scanPages, setScanPages] = useState("");

  const [requesterName, setRequesterName] = useState("");
  const [requesterEmail, setRequesterEmail] = useState("");
  const [requesterOrganization, setRequesterOrganization] = useState("");

  const calculatedQuote = useMemo(
    () =>
      calculatePrintShopQuote(
        estimateItems.map((entry) => entry.item),
        pricing
      ),
    [estimateItems, pricing]
  );

  const posterHelper = pricing.posterTiers[posterSaturation];
  const bindingHelper = pricing.bindingTiers[bindingType];

  function addEstimateItem(item: PrintEstimateInput) {
    setEstimateItems((current) => [...current, { id: newId(), item }]);
  }

  function removeEstimateItem(id: string) {
    setEstimateItems((current) => current.filter((entry) => entry.id !== id));
  }

  function resetAll() {
    setEstimateItems([]);
    setCopyMode("BW");
    setCopySides("SINGLE");
    setCopyPages("");
    setCopySets("1");
    setPosterQuantity("1");
    setPosterSaturation("LOW");
    setPosterNotes("");
    setBindingType("COMB");
    setBindingQuantity("1");
    setScanPages("");
    setRequesterName("");
    setRequesterEmail("");
    setRequesterOrganization("");
  }

  function handleAddCopy() {
    const totalPages = parsePositiveInteger(copyPages);
    const quantitySets = parsePositiveInteger(copySets) ?? 1;

    if (!totalPages) {
      toast.error("Enter a valid page count for copies.");
      return;
    }

    addEstimateItem({
      kind: "copies",
      mode: copyMode,
      sides: copySides,
      totalPages,
      quantitySets,
      paper: "24LB",
    });

    setCopyPages("");
    setCopySets("1");
    toast.success("Copy service added to estimate.");
  }

  function handleAddPoster() {
    const quantity = parsePositiveInteger(posterQuantity);
    if (!quantity) {
      toast.error("Poster quantity must be at least 1.");
      return;
    }

    addEstimateItem({
      kind: "poster",
      quantity,
      saturation: posterSaturation,
      notes: posterNotes.trim() || undefined,
    });

    setPosterQuantity("1");
    setPosterNotes("");
    toast.success("Poster service added to estimate.");
  }

  function handleAddBinding() {
    const quantity = parsePositiveInteger(bindingQuantity);
    if (!quantity) {
      toast.error("Binding quantity must be at least 1.");
      return;
    }

    addEstimateItem({
      kind: "binding",
      bindingType,
      quantity,
    });

    setBindingQuantity("1");
    toast.success("Binding service added to estimate.");
  }

  function handleAddScanning() {
    const totalPages = parsePositiveInteger(scanPages);
    if (!totalPages) {
      toast.error("Scanning page count must be at least 1.");
      return;
    }

    addEstimateItem({
      kind: "scanning",
      totalPages,
    });

    setScanPages("");
    toast.success("Scanning service added to estimate.");
  }

  async function handleCopyEstimate() {
    try {
      await navigator.clipboard.writeText(buildEstimateSummaryText(pricing, estimateItems));
      toast.success("Estimate summary copied to clipboard.");
    } catch {
      toast.error("Could not copy the estimate summary.");
    }
  }

  async function handleGenerateQuote() {
    if (estimateItems.length === 0) {
      toast.error("Add at least one service before generating a quote.");
      return;
    }

    setIsGenerating(true);

    try {
      const response = await printPricingApi.generateQuote({
        items: estimateItems.map((entry) => entry.item),
        requesterName,
        requesterEmail,
        requesterOrganization,
      });

      const link = document.createElement("a");
      link.href = response.downloadUrl;
      link.download = `${response.quoteNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success(`Quote ${response.quoteNumber} is ready.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate quote.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="relative mx-auto max-w-7xl pb-24 md:pb-10">
      <div className="mb-6 rounded-[28px] border border-border/70 bg-[linear-gradient(135deg,rgba(248,250,252,0.95),rgba(255,255,255,0.92))] px-4 py-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)] sm:mb-8 sm:px-6 sm:py-8">
        <div className="max-w-3xl space-y-3">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">Public estimator</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl md:text-4xl">
            Print shop price calculator
          </h1>
          <p className="text-sm leading-6 text-muted-foreground md:text-base">
            Build a multi-service quote for copies, posters, binding, and scanning. Rates come directly from the
            admin-managed pricing table, and totals update live as services are added.
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <ServiceCard
              title="Copies"
              description="Estimate black-and-white or color copy jobs with tiered pricing and duplex support."
              footer={
                <Button className="w-full" onClick={handleAddCopy}>
                  <FilePlus2Icon className="mr-2 size-4" />
                  Add copy service
                </Button>
              }
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="copy-mode">Print mode</Label>
                  <Select value={copyMode} onValueChange={(value) => setCopyMode(value as CopyMode)}>
                    <SelectTrigger id="copy-mode" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BW">B&amp;W</SelectItem>
                      <SelectItem value="COLOR">Color</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="copy-sides">Sides</Label>
                  <Select value={copySides} onValueChange={(value) => setCopySides(value as CopySides)}>
                    <SelectTrigger id="copy-sides" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SINGLE">Single-sided</SelectItem>
                      <SelectItem value="DOUBLE">Double-sided</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="copy-pages">Total pages</Label>
                  <Input
                    id="copy-pages"
                    inputMode="numeric"
                    value={copyPages}
                    onChange={(event) => setCopyPages(event.target.value)}
                    placeholder="e.g. 250"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="copy-sets">Quantity sets</Label>
                  <Input
                    id="copy-sets"
                    inputMode="numeric"
                    value={copySets}
                    onChange={(event) => setCopySets(event.target.value)}
                    placeholder="1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="copy-paper">Paper</Label>
                <Input id="copy-paper" value="24 lb copy paper" disabled />
              </div>

              <CopyTierPreview
                pricing={pricing}
                mode={copyMode}
                totalPages={copyPages}
                quantitySets={copySets}
                sides={copySides}
              />
            </ServiceCard>

            <ServiceCard
              title='24" x 36" posters'
              description="Choose the saturation level that best matches the expected ink coverage."
              footer={
                <Button className="w-full" onClick={handleAddPoster}>
                  <PrinterIcon className="mr-2 size-4" />
                  Add poster service
                </Button>
              }
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="poster-quantity">Quantity</Label>
                  <Input
                    id="poster-quantity"
                    inputMode="numeric"
                    value={posterQuantity}
                    onChange={(event) => setPosterQuantity(event.target.value)}
                    placeholder="1"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="poster-saturation">Saturation</Label>
                  <Select
                    value={posterSaturation}
                    onValueChange={(value) => setPosterSaturation(value as PosterSaturation)}
                  >
                    <SelectTrigger id="poster-saturation" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Low</SelectItem>
                      <SelectItem value="MEDIUM">Medium</SelectItem>
                      <SelectItem value="HIGH">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-lg border border-border/80 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <div className="font-medium text-foreground">
                  {posterHelper.label} saturation: {centsToCurrency(posterHelper.unitPriceCents)} each
                </div>
                <div className="mt-1">{posterHelper.description}</div>
                <div className="mt-2 text-[11px] text-amber-700">
                  Final poster pricing may be adjusted after file review.
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="poster-notes">Optional notes</Label>
                <Textarea
                  id="poster-notes"
                  value={posterNotes}
                  onChange={(event) => setPosterNotes(event.target.value)}
                  placeholder="Any sizing, stock, or finishing notes for the poster review."
                />
              </div>
            </ServiceCard>

            <ServiceCard
              title="Binding"
              description="Flat pricing per bound item for standard comb and glue binding."
              footer={
                <Button className="w-full" onClick={handleAddBinding}>
                  <FilePlus2Icon className="mr-2 size-4" />
                  Add binding service
                </Button>
              }
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="binding-type">Binding type</Label>
                  <Select value={bindingType} onValueChange={(value) => setBindingType(value as BindingType)}>
                    <SelectTrigger id="binding-type" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="COMB">Comb</SelectItem>
                      <SelectItem value="GLUE">Glue</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="binding-quantity">Quantity</Label>
                  <Input
                    id="binding-quantity"
                    inputMode="numeric"
                    value={bindingQuantity}
                    onChange={(event) => setBindingQuantity(event.target.value)}
                    placeholder="1"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-border/80 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <div className="font-medium text-foreground">
                  {bindingHelper.label} binding: {centsToCurrency(bindingHelper.unitPriceCents)} each
                </div>
                <div className="mt-1">{bindingHelper.description}</div>
              </div>
            </ServiceCard>

            <ServiceCard
              title="Scanning"
              description="Tiered per-page rates with an automatic minimum charge for small jobs."
              footer={
                <Button className="w-full" onClick={handleAddScanning}>
                  <ScanLineIcon className="mr-2 size-4" />
                  Add scanning service
                </Button>
              }
            >
              <div className="space-y-2">
                <Label htmlFor="scan-pages">Total pages</Label>
                <Input
                  id="scan-pages"
                  inputMode="numeric"
                  value={scanPages}
                  onChange={(event) => setScanPages(event.target.value)}
                  placeholder="e.g. 50"
                />
              </div>

              <ScanTierPreview pricing={pricing} pages={scanPages} />

              <p className="text-xs text-muted-foreground">
                Minimum scan charge: {centsToCurrency(pricing.minimumScanChargeCents)}.
              </p>
            </ServiceCard>
          </div>

          <Card className="border border-border/70">
            <CardHeader>
              <CardTitle>Estimate items</CardTitle>
              <CardDescription>
                Add multiple services to build a combined quote before generating the PDF.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <AnimatePresence initial={false}>
                {estimateItems.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    No services added yet. Use the cards above to build an estimate.
                  </motion.div>
                ) : (
                  estimateItems.map((entry) => {
                    const preview = calculatePrintShopQuote([entry.item], pricing).lineItems[0];

                    return (
                      <motion.div
                        key={entry.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="rounded-xl border border-border/80 bg-background px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.03)]"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <div className="font-medium text-foreground">{preview.description}</div>
                            <div className="text-sm text-muted-foreground">{preview.details}</div>
                            <div className="text-xs text-muted-foreground">
                              Tier: {preview.selectedTierLabel}. Line total: {centsToCurrency(preview.lineTotalCents)}
                            </div>
                          </div>
                          <Button variant="ghost" size="icon-sm" onClick={() => removeEstimateItem(entry.id)}>
                            <Trash2Icon className="size-4" />
                            <span className="sr-only">Remove item</span>
                          </Button>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </div>

        <div className="hidden xl:block">
          <div className="xl:sticky xl:top-24">
            <Card className="border border-border/70 shadow-[0_16px_36px_rgba(15,23,42,0.06)]">
              <CardHeader>
                <CardTitle>Live summary</CardTitle>
                <CardDescription>Review totals, optional requester details, and final actions.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="requester-name">Requester name</Label>
                    <Input
                      id="requester-name"
                      value={requesterName}
                      onChange={(event) => setRequesterName(event.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="requester-email">Requester email</Label>
                    <Input
                      id="requester-email"
                      type="email"
                      value={requesterEmail}
                      onChange={(event) => setRequesterEmail(event.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="requester-org">Organization</Label>
                    <Input
                      id="requester-org"
                      value={requesterOrganization}
                      onChange={(event) => setRequesterOrganization(event.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  {calculatedQuote.lineItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Totals will appear once services are added.</p>
                  ) : (
                    calculatedQuote.lineItems.map((item, index) => (
                      <div key={`${item.description}-${index}`} className="flex items-start justify-between gap-3 text-sm">
                        <div>
                          <div className="font-medium text-foreground">{item.description}</div>
                          <div className="text-muted-foreground">
                            {item.quantity} x {centsToCurrency(item.effectiveUnitPriceCents)}
                          </div>
                        </div>
                        <div className="font-medium text-foreground">{centsToCurrency(item.lineTotalCents)}</div>
                      </div>
                    ))
                  )}
                </div>

                <Separator />

                <motion.div
                  key={calculatedQuote.totalCents}
                  initial={{ opacity: 0.85, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-2"
                >
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Subtotal</span>
                    <span>{centsToCurrency(calculatedQuote.subtotalCents)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>
                      Tax {calculatedQuote.taxEnabled ? `(${percentBasisPointsToLabel(calculatedQuote.taxRateBasisPoints)})` : ""}
                    </span>
                    <span>{centsToCurrency(calculatedQuote.taxCents)}</span>
                  </div>
                  <div className="flex items-center justify-between text-base font-semibold text-foreground">
                    <span>Total</span>
                    <span>{centsToCurrency(calculatedQuote.totalCents)}</span>
                  </div>
                </motion.div>

                <div className="rounded-lg border border-border/80 bg-muted/40 px-3 py-3 text-xs text-muted-foreground">
                  {pricing.quoteDisclaimer}
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-2">
                <Button className="w-full" onClick={handleGenerateQuote} disabled={estimateItems.length === 0 || isGenerating}>
                  <PrinterIcon className="mr-2 size-4" />
                  {isGenerating ? "Generating PDF..." : "Generate quote PDF"}
                </Button>
                <Button className="w-full" variant="outline" onClick={handleCopyEstimate} disabled={estimateItems.length === 0}>
                  <CopyIcon className="mr-2 size-4" />
                  Copy estimate summary
                </Button>
                <Button className="w-full" variant="ghost" onClick={resetAll} disabled={estimateItems.length === 0}>
                  <RefreshCcwIcon className="mr-2 size-4" />
                  Reset estimate
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>

      <div className="fixed inset-x-4 bottom-4 z-40 xl:hidden">
        <div className="rounded-2xl border border-border/80 bg-background/95 p-4 shadow-[0_22px_40px_rgba(15,23,42,0.18)] backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Estimate total</div>
              <div className="text-lg font-semibold text-foreground">{centsToCurrency(calculatedQuote.totalCents)}</div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCopyEstimate} disabled={estimateItems.length === 0}>
                <CopyIcon className="mr-2 size-4" />
                Copy
              </Button>
              <Button size="sm" onClick={handleGenerateQuote} disabled={estimateItems.length === 0 || isGenerating}>
                <PrinterIcon className="mr-2 size-4" />
                {isGenerating ? "Working..." : "PDF"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
