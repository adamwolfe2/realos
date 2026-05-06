"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Download, MapPin } from "lucide-react";

// ---------------------------------------------------------------------------
// VisitorTable
//
// Selectable visitor list with bulk CSV export. Replaces the server-only
// DataTable rendering on /portal/visitors so the operator can:
//   - Select individual rows or "select all"
//   - Export the current selection as a CSV with first name, last name,
//     email, location, and last page (the operationally useful columns —
//     no intent / status noise)
//
// Selection state lives client-side; the server pre-shapes the row data
// into a flat JSON-safe shape so we don't lose Dates across the boundary.
// ---------------------------------------------------------------------------

export type VisitorRow = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string;
  email: string | null;
  location: string | null;
  lastPage: string | null;
  lastPageUrl: string | null;
  sessions: number;
  lastSeenAtIso: string;
  liveChat: boolean;
};

type Props = {
  rows: VisitorRow[];
};

export function VisitorTable({ rows }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const someSelected = selected.size > 0 && selected.size < rows.length;

  const toggleAll = () => {
    if (allSelected || someSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(rows.map((r) => r.id)));
    }
  };

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedRows = useMemo(
    () => rows.filter((r) => selected.has(r.id)),
    [rows, selected],
  );

  const handleExport = () => {
    const targets = selectedRows.length > 0 ? selectedRows : rows;
    const csv = buildCsv(targets);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `visitors-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-2">
      {/* Bulk action bar — only renders when rows are selected, doesn't
          shift layout when empty because it sits above the table. */}
      {selected.size > 0 ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-blue-900">
            {selected.size} of {rows.length} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-[11px] font-medium text-blue-900/70 hover:text-blue-900"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 text-white px-3 py-1.5 text-[11px] font-semibold hover:bg-blue-700 transition-colors"
            >
              <Download className="h-3 w-3" />
              Export {selected.size} as CSV
            </button>
          </div>
        </div>
      ) : null}

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-secondary/40">
                <th className="px-3 py-2 w-[36px]">
                  <input
                    type="checkbox"
                    aria-label="Select all rows"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={toggleAll}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                  />
                </th>
                <Th>Visitor</Th>
                <Th hideOnMobile>Email</Th>
                <Th hideOnMobile>Last page</Th>
                <Th hideOnMobile>Location</Th>
                <Th align="right">Sessions</Th>
                <Th>Last seen</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isSelected = selected.has(r.id);
                return (
                  <tr
                    key={r.id}
                    className={
                      "border-b border-border last:border-0 transition-colors group " +
                      (isSelected ? "bg-blue-50/40 " : "hover:bg-muted/40")
                    }
                  >
                    <td className="px-3 py-2 align-middle">
                      <input
                        type="checkbox"
                        aria-label={`Select ${r.displayName}`}
                        checked={isSelected}
                        onChange={() => toggleRow(r.id)}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                      />
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <Link
                        href={`/portal/visitors/${r.id}`}
                        className="block min-w-0"
                      >
                        <div className="text-[12px] font-semibold text-foreground truncate">
                          {r.displayName}
                        </div>
                        {r.firstName || r.lastName ? null : r.email ? (
                          <div className="text-[10px] text-muted-foreground truncate md:hidden">
                            {r.email}
                          </div>
                        ) : null}
                      </Link>
                    </td>
                    <td className="px-3 py-2 align-middle hidden md:table-cell">
                      {r.email ? (
                        <span className="text-[11px] text-foreground">
                          {r.email}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 align-middle hidden md:table-cell">
                      {r.lastPage ? (
                        <span
                          className="text-[11px] text-muted-foreground truncate inline-block max-w-[220px]"
                          title={r.lastPageUrl ?? r.lastPage}
                        >
                          {r.lastPage}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 align-middle hidden md:table-cell">
                      {r.location ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <MapPin
                            className="h-2.5 w-2.5 opacity-60"
                            aria-hidden="true"
                          />
                          {r.location}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 align-middle text-right tabular-nums text-[11px]">
                      {r.sessions}
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <span className="text-[11px] text-muted-foreground">
                        {formatDistanceToNow(new Date(r.lastSeenAtIso), {
                          addSuffix: true,
                        })}
                      </span>
                      {r.liveChat ? (
                        <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-emerald-700 font-semibold">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Live
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Th({
  children,
  align = "left",
  hideOnMobile = false,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  hideOnMobile?: boolean;
}) {
  return (
    <th
      scope="col"
      className={
        "px-3 py-2 text-[10px] tracking-widest uppercase font-semibold text-muted-foreground whitespace-nowrap " +
        (align === "right" ? "text-right " : "text-left ") +
        (hideOnMobile ? "hidden md:table-cell" : "")
      }
    >
      {children}
    </th>
  );
}

// ---------------------------------------------------------------------------
// CSV builder — RFC 4180-ish: comma separator, double-quote escaping,
// CRLF line endings. Excel + Google Sheets handle this correctly.
// ---------------------------------------------------------------------------

function buildCsv(rows: VisitorRow[]): string {
  const headers = [
    "First name",
    "Last name",
    "Email",
    "Location",
    "Last page",
    "Sessions",
    "Last seen",
  ];
  const lines = [headers.map(csvEscape).join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.firstName ?? "",
        r.lastName ?? "",
        r.email ?? "",
        r.location ?? "",
        r.lastPage ?? "",
        String(r.sessions),
        r.lastSeenAtIso,
      ]
        .map(csvEscape)
        .join(","),
    );
  }
  return lines.join("\r\n");
}

function csvEscape(value: string): string {
  if (value.includes('"') || value.includes(",") || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
