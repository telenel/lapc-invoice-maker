import type { ProductSummaryFreshness } from "@/domains/product/summary-types";

interface ProductsFreshnessBannerProps {
  trust: ProductSummaryFreshness["analyticsTrust"];
  latestSyncCompletedAt: string | null;
  latestSyncStatus: ProductSummaryFreshness["latestSyncStatus"];
}

export function ProductsFreshnessBanner({
  trust,
  latestSyncCompletedAt,
  latestSyncStatus,
}: ProductsFreshnessBannerProps) {
  if (trust === "ready" && latestSyncStatus === "ok") {
    return null;
  }

  const message =
    trust === "partial"
      ? "Analytics partial — some transaction-derived metrics are still uncomputed."
      : trust === "stale"
        ? "Analytics stale — transaction-derived metrics may lag the latest catalog state."
        : "Analytics trust unknown — verify sync history before acting on trend or velocity data.";

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <div className="font-medium">{message}</div>
      <div className="mt-1 text-xs text-amber-800">
        Last sync: {latestSyncCompletedAt ? new Date(latestSyncCompletedAt).toLocaleString() : "unknown"} · status: {latestSyncStatus}
      </div>
    </div>
  );
}
