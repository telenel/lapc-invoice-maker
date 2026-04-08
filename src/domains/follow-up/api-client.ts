import type {
  InitiateFollowUpResponse,
  FollowUpBadgeState,
} from "./types";

export const followUpApi = {
  async initiate(invoiceIds: string[]): Promise<InitiateFollowUpResponse> {
    const res = await fetch("/api/follow-ups/initiate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceIds }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Request failed" }));
      throw new Error(err.error ?? "Request failed");
    }
    return res.json();
  },

  async getBadgeState(invoiceId: string): Promise<FollowUpBadgeState | null> {
    const res = await fetch(`/api/follow-ups/badge?invoiceId=${invoiceId}`);
    if (!res.ok) return null;
    return res.json();
  },

  async getBadgeStatesForInvoices(
    invoiceIds: string[],
  ): Promise<Record<string, FollowUpBadgeState>> {
    if (invoiceIds.length === 0) return {};
    const res = await fetch(
      `/api/follow-ups/badge?invoiceIds=${invoiceIds.join(",")}`,
    );
    if (!res.ok) return {};
    return res.json();
  },

  async getPendingAccounts(): Promise<{
    count: number;
    items: Array<{
      invoiceId: string;
      invoiceNumber: string | null;
      quoteNumber: string | null;
      type: string;
      staffName: string;
      creatorName: string;
      creatorId: string;
      currentAttempt: number;
      maxAttempts: number;
      seriesStatus: string;
    }>;
  }> {
    const res = await fetch("/api/follow-ups/pending");
    if (!res.ok) throw new Error("Failed to fetch pending accounts");
    return res.json();
  },
};
