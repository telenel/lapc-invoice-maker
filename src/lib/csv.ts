/**
 * Escapes a single CSV field value.
 * - Wraps in double quotes if the value contains a comma, double quote, newline, or carriage return
 * - Doubles any embedded double quotes (RFC 4180)
 */
export function escapeCsv(value: string): string {
  if (
    value.includes(",") ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Builds a full CSV string from a headers array and a 2-D rows array.
 * Each cell is automatically escaped.
 */
export function buildCsv(headers: string[], rows: string[][]): string {
  const headerLine = headers.map(escapeCsv).join(",");
  const dataLines = rows.map((row) => row.map(escapeCsv).join(","));
  return [headerLine, ...dataLines].join("\n");
}
