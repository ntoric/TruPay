/**
 * Convert an array of objects into a CSV string.
 * - Handles escaping of commas, quotes, and newlines.
 * - Dates are converted to ISO strings.
 * - Decimal/number values are passed through.
 * - null/undefined become empty strings.
 */
export function toCSV<T extends Record<string, unknown>>(
  rows: T[],
  columns?: (keyof T)[],
): string {
  if (rows.length === 0) {
    return columns ? columns.join(",") + "\n" : "";
  }

  const cols = (columns ?? (Object.keys(rows[0]) as (keyof T)[])) as (keyof T)[];

  const escape = (val: unknown): string => {
    if (val === null || val === undefined) return "";
    if (val instanceof Date) return val.toISOString();
    if (typeof val === "object") {
      // Decimal objects expose toNumber()
      const d = val as { toNumber?: () => number };
      if (typeof d.toNumber === "function") return String(d.toNumber());
      return JSON.stringify(val);
    }
    const str = String(val);
    // Escape if the value contains commas, quotes, or newlines
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const header = cols.map((c) => escape(c as string)).join(",");
  const body = rows
    .map((row) => cols.map((c) => escape(row[c])).join(","))
    .join("\n");

  return header + "\n" + body + "\n";
}
