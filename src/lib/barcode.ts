import JsBarcode from "jsbarcode";

/**
 * Render a Code 128 barcode as an SVG markup string.
 * Uses an off-screen SVG element so JsBarcode can render to it,
 * then extracts the outerHTML. The element is never added to the DOM.
 */
export function renderBarcodeSvg(value: string): string {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  try {
    JsBarcode(svg, value, {
      format: "CODE128",
      width: 1.5,
      height: 50,
      displayValue: true,
      fontSize: 12,
      margin: 5,
    });
    return svg.outerHTML;
  } catch {
    return `<span style="color:red;font-size:11px;">Barcode error for ${escapeHtml(value)}</span>`;
  }
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
