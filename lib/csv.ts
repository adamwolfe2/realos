// Tiny CSV helpers shared by export routes.

export function csvField(raw: unknown): string {
  if (raw == null) return "";
  let s = typeof raw === "string" ? raw : String(raw);
  if (s === "") return "";
  // Formula-injection guard (review 2026-07-31): a value starting with
  // = + - @ or a tab/CR executes as a formula when the export is opened
  // in Excel/Sheets. User-controlled fields (e.g. referral sourceDetail
  // straight off the URL) reach these exports, so neutralize with a
  // leading apostrophe — the standard spreadsheet escape.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  const needsQuote = /[,"\n\r']/.test(s);
  const escaped = s.replace(/"/g, '""');
  return needsQuote ? `"${escaped}"` : escaped;
}

export function csvRow(values: unknown[]): string {
  return values.map(csvField).join(",");
}

export function buildCsv(header: string[], rows: unknown[][]): string {
  return [csvRow(header), ...rows.map(csvRow)].join("\n") + "\n";
}

export function csvFileResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
