"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Download, MapPin, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { SideDrawer } from "@/components/portal/ui/side-drawer";
import { BulkActionBar } from "@/components/portal/ui/bulk-action-bar";

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
  // openId drives the SideDrawer — surface a quick-look summary without
  // navigating away from the feed. The full /portal/visitors/[id] page
  // remains canonical and deep-linkable.
  const [openId, setOpenId] = useState<string | null>(null);
  const openVisitor = useMemo(
    () => rows.find((r) => r.id === openId) ?? null,
    [rows, openId],
  );

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
    toast.success(`Exported ${targets.length} visitor${targets.length === 1 ? "" : "s"} as CSV`);
  };

  // Stub bulk actions. Both kept as stubs because the current
  // /portal/audiences pipeline is one-way (AudienceLab segments are
  // pulled from AL — there's no org-controlled "push these visitors to
  // an audience" model). Send-to-ads depends on the same sync
  // infrastructure (push to Meta / Google / TikTok via AL destinations).
  // Toast copy makes the stub status explicit.
  const stubPushToAudience = () => {
    toast.message("Pushing visitors to audiences is coming soon", {
      description:
        "Audiences today are pulled from AudienceLab. Track outbound push at /portal/insights.",
    });
    setSelected(new Set());
  };
  const stubSendToAds = () => {
    toast.message("Sending visitors to ads is coming soon", {
      description:
        "Requires the audience-sync pipeline. Track this at /portal/insights.",
    });
    setSelected(new Set());
  };

  return (
    <div className="space-y-2">
      {/* Bulk action bar — uses the canonical BulkActionBar primitive so
          the toolbar shape matches Leads / Renewals. Renders nothing when
          no rows are selected. Push-to-audience and Send-to-ads are stubs
          that toast success until the corresponding pipelines ship. */}
      <BulkActionBar
        count={selected.size}
        onClear={() => setSelected(new Set())}
        noun="visitor"
      >
        <button
          type="button"
          onClick={handleExport}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary-dark px-2.5 py-1 text-xs font-medium transition-colors"
        >
          <Download className="h-3 w-3" aria-hidden="true" />
          Export CSV
        </button>
        <button
          type="button"
          onClick={stubPushToAudience}
          className="inline-flex items-center rounded-md border border-border bg-background hover:bg-muted px-2.5 py-1 text-xs font-medium transition-colors"
        >
          Push to audience
        </button>
        <button
          type="button"
          onClick={stubSendToAds}
          className="inline-flex items-center rounded-md border border-border bg-background hover:bg-muted px-2.5 py-1 text-xs font-medium transition-colors"
        >
          Send to ads
        </button>
      </BulkActionBar>

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
                    onClick={(e) => {
                      // Skip when the click came from an interactive element
                      // (checkbox, link) so we don't double-fire.
                      const target = e.target as HTMLElement;
                      if (target.closest("a, button, input, select, label"))
                        return;
                      setOpenId(r.id);
                    }}
                    className={
                      "border-b border-border last:border-0 transition-colors group cursor-pointer " +
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

      <SideDrawer
        open={openVisitor != null}
        onOpenChange={(o) => setOpenId(o ? openId : null)}
        title={openVisitor?.displayName ?? ""}
        description={openVisitor?.email ?? openVisitor?.location ?? undefined}
        headerActions={
          openVisitor ? (
            <Link
              href={`/portal/visitors/${openVisitor.id}`}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background hover:bg-muted px-2 py-1 text-[11px] font-medium text-foreground transition-colors"
            >
              Open full page
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </Link>
          ) : null
        }
        footer={
          openVisitor ? (
            <Link
              href={`/portal/visitors/${openVisitor.id}`}
              className="inline-flex items-center rounded-md bg-primary text-primary-foreground hover:bg-primary-dark px-3 py-1.5 text-xs font-medium transition-colors"
            >
              Open full page
            </Link>
          ) : null
        }
      >
        {openVisitor ? <VisitorDrawerBody row={openVisitor} /> : null}
      </SideDrawer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// VisitorDrawerBody — surface-level summary surfaced when an operator
// clicks a row. Intentionally minimal; the canonical
// /portal/visitors/[id] page holds the full identification + page history.
// ---------------------------------------------------------------------------
function VisitorDrawerBody({ row }: { row: VisitorRow }) {
  return (
    <div className="space-y-4 text-sm">
      <section className="space-y-1.5">
        <h3 className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
          Identity
        </h3>
        <dl className="grid grid-cols-3 gap-x-3 gap-y-1.5 text-xs">
          <dt className="text-muted-foreground">Name</dt>
          <dd className="col-span-2 text-foreground">
            {row.firstName || row.lastName
              ? [row.firstName, row.lastName].filter(Boolean).join(" ")
              : <span className="text-muted-foreground">—</span>}
          </dd>
          <dt className="text-muted-foreground">Email</dt>
          <dd className="col-span-2 text-foreground break-all">
            {row.email ?? <span className="text-muted-foreground">—</span>}
          </dd>
          <dt className="text-muted-foreground">Location</dt>
          <dd className="col-span-2 text-foreground">
            {row.location ?? <span className="text-muted-foreground">—</span>}
          </dd>
        </dl>
      </section>

      <section className="space-y-1.5">
        <h3 className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
          Activity
        </h3>
        <dl className="grid grid-cols-3 gap-x-3 gap-y-1.5 text-xs">
          <dt className="text-muted-foreground">Last seen</dt>
          <dd className="col-span-2 text-foreground">
            {formatDistanceToNow(new Date(row.lastSeenAtIso), { addSuffix: true })}
          </dd>
          <dt className="text-muted-foreground">Sessions</dt>
          <dd className="col-span-2 text-foreground tabular-nums">
            {row.sessions}
          </dd>
          <dt className="text-muted-foreground">Last page</dt>
          <dd className="col-span-2 text-foreground">
            {row.lastPageUrl ? (
              <a
                href={row.lastPageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline break-all"
              >
                {row.lastPage ?? row.lastPageUrl}
              </a>
            ) : row.lastPage ? (
              <span>{row.lastPage}</span>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </dd>
        </dl>
      </section>

      {row.liveChat ? (
        <section className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800">
          This visitor is in a live chat right now.
        </section>
      ) : null}

      <p className="text-[11px] text-muted-foreground">
        Top pages and intent-score history live on the full visitor page.
      </p>
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
