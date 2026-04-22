import type {
  QuickPickSectionDto,
  QuickPickSectionFormValues,
  QuickPickSectionPatchInput,
  QuickPickSectionPreviewResult,
  QuickPickSectionScopeInput,
} from "./types";

async function parseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === "string" && body.error.trim()) {
      return body.error;
    }
    if (body.error && typeof body.error === "object") {
      return JSON.stringify(body.error);
    }
  } catch {
    // Fall back to the HTTP status below when no JSON error body is present.
  }

  return response.statusText || `HTTP ${response.status}`;
}

export const quickPickSectionsApi = {
  async listQuickPickSections(): Promise<QuickPickSectionDto[]> {
    const response = await fetch("/api/quick-pick-sections", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(await parseError(response));
    }
    const body = (await response.json()) as { items: QuickPickSectionDto[] };
    return body.items;
  },

  async createQuickPickSection(input: QuickPickSectionFormValues): Promise<QuickPickSectionDto> {
    const response = await fetch("/api/quick-pick-sections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      throw new Error(await parseError(response));
    }
    return (await response.json()) as QuickPickSectionDto;
  },

  async updateQuickPickSection(
    id: string,
    input: QuickPickSectionPatchInput,
  ): Promise<QuickPickSectionDto> {
    const response = await fetch(`/api/quick-pick-sections/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      throw new Error(await parseError(response));
    }
    return (await response.json()) as QuickPickSectionDto;
  },

  async deleteQuickPickSection(id: string): Promise<void> {
    const response = await fetch(`/api/quick-pick-sections/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error(await parseError(response));
    }
  },

  async previewQuickPickSection(
    input: QuickPickSectionScopeInput,
  ): Promise<QuickPickSectionPreviewResult> {
    const response = await fetch("/api/quick-pick-sections/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      throw new Error(await parseError(response));
    }
    return (await response.json()) as QuickPickSectionPreviewResult;
  },
};
