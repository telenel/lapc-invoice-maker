export type EditDialogMode = "legacy" | "v2";

export function resolveEditDialogMode(input: {
  featureFlagEnabled: boolean;
  override: string | null;
  hasTextbookSelection: boolean;
}): EditDialogMode {
  if (input.hasTextbookSelection) return "legacy";
  if (input.override === "legacy") return "legacy";
  if (input.override === "v2") return "v2";
  return input.featureFlagEnabled ? "v2" : "legacy";
}
