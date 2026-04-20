export function shouldApplyDefaultMinStock(
  params: URLSearchParams,
  hasViewParam: boolean,
  currentMinStock: string,
): boolean {
  if (hasViewParam) return false;
  return !params.has("minStock") && currentMinStock === "";
}
