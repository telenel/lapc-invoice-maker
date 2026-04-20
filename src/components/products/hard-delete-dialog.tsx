"use client";

import { useEffect, useState } from "react";
import { productApi } from "@/domains/product/api-client";
import { PrismWriteConfirmationDialog } from "@/components/products/prism-write-confirmation-dialog";

interface HardDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Rows selected for hard-delete. If a row is a textbook, it's blocked with a distinct message. */
  items: Array<{ sku: number; description?: string; isTextbook?: boolean }>;
  /** Called after a successful hard-delete. */
  onDeleted?: (skus: number[]) => void;
  /** Called when the user opts to discontinue instead. */
  onDiscontinueInstead?: (skus: number[]) => void;
}

type Verdict = "safe" | "has-history" | "textbook" | "loading";

export function HardDeleteDialog({ open, onOpenChange, items, onDeleted, onDiscontinueInstead }: HardDeleteDialogProps) {
  const [verdicts, setVerdicts] = useState<Map<number, Verdict>>(new Map());
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const initial = new Map<number, Verdict>();
    for (const it of items) {
      initial.set(it.sku, it.isTextbook ? "textbook" : "loading");
    }
    setVerdicts(initial);

    const gmSkus = items.filter((i) => !i.isTextbook).map((i) => i.sku);
    if (gmSkus.length === 0) return;

    productApi.historyCheck(gmSkus)
      .then((hist) => {
        const next = new Map(initial);
        for (const sku of gmSkus) {
          next.set(sku, hist[String(sku)] ? "has-history" : "safe");
        }
        setVerdicts(next);
      })
      .catch((e) => setError(String(e)));
  }, [open, items]);

  const allSafe = items.length > 0 && items.every((i) => verdicts.get(i.sku) === "safe");
  const blockedSkus = items.filter((i) => verdicts.get(i.sku) !== "safe").map((i) => i.sku);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      if (items.length === 1) {
        await productApi.hardDelete(items[0].sku);
      } else {
        const result = await productApi.batch({ action: "hard-delete", skus: items.map((i) => i.sku) });
        if ("errors" in result && result.errors.length > 0) {
          setError(result.errors.map((e) => e.message).join("; "));
          return;
        }
      }
      onDeleted?.(items.map((i) => i.sku));
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <PrismWriteConfirmationDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Permanently delete ${items.length} item${items.length !== 1 ? "s" : ""}?`}
      description="Hard-delete removes the row from Prism entirely."
      warnings={[
        "This permanently removes data from Prism and the POS database.",
        "This action is only appropriate for test items with no history.",
        "There is no undo from this UI.",
      ]}
      confirmPhrase="DELETE FROM PRISM"
      confirmLabel={deleting ? "Deleting..." : "Delete permanently"}
      confirming={deleting}
      confirmDisabled={!allSafe}
      onConfirm={handleDelete}
    >
      <div className="max-h-80 space-y-2 overflow-y-auto">
        {items.map((it) => {
          const v = verdicts.get(it.sku) ?? "loading";
          return (
            <div key={it.sku} className="flex items-start justify-between gap-3 rounded border px-3 py-2 text-sm">
              <div>
                <div className="font-mono">{it.sku}</div>
                {it.description ? <div className="text-muted-foreground">{it.description}</div> : null}
              </div>
              <div>
                {v === "loading" && <span className="text-muted-foreground">checking…</span>}
                {v === "safe" && <span className="text-green-700">0 history records — safe</span>}
                {v === "has-history" && <span className="text-destructive">has history — discontinue instead</span>}
                {v === "textbook" && <span className="text-destructive">textbook — not supported, discontinue</span>}
              </div>
            </div>
          );
        })}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {blockedSkus.length > 0 && onDiscontinueInstead ? (
        <button
          type="button"
          onClick={() => {
            onDiscontinueInstead(blockedSkus);
            onOpenChange(false);
          }}
          className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Discontinue blocked ({blockedSkus.length})
        </button>
      ) : null}
    </PrismWriteConfirmationDialog>
  );
}
