import type { Metadata } from "next";
import Link from "next/link";
import { requireAgency } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { formatDistanceToNow } from "date-fns";
import { PageHeader } from "@/components/admin/page-header";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Pixel health" };
export const dynamic = "force-dynamic";

const FIRING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const STALE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export default async function PixelHealthPage() {
  await requireAgency();

  const integrations = await prisma.cursiveIntegration.findMany({
    orderBy: { lastEventAt: "desc" },
    select: {
      orgId: true,
      cursivePixelId: true,
      installedOnDomain: true,
      lastEventAt: true,
      totalEventsCount: true,
      org: {
        select: { id: true, name: true, slug: true, status: true },
      },
    },
  });

  const now = Date.now();

  const rows = integrations.map((i) => {
    const lastMs = i.lastEventAt ? new Date(i.lastEventAt).getTime() : null;
    const hasCursive = Boolean(i.cursivePixelId);
    const firing = lastMs !== null && now - lastMs < FIRING_WINDOW_MS;
    const stale = lastMs !== null && now - lastMs >= FIRING_WINDOW_MS && now - lastMs < STALE_WINDOW_MS;

    let pixelStatus: "firing" | "stale" | "dark" | "unconfigured";
    if (!hasCursive) pixelStatus = "unconfigured";
    else if (firing) pixelStatus = "firing";
    else if (stale) pixelStatus = "stale";
    else pixelStatus = "dark";

    return { ...i, hasCursive, pixelStatus };
  });

  const counts = {
    firing: rows.filter((r) => r.pixelStatus === "firing").length,
    stale: rows.filter((r) => r.pixelStatus === "stale").length,
    dark: rows.filter((r) => r.pixelStatus === "dark").length,
    unconfigured: rows.filter((r) => r.pixelStatus === "unconfigured").length,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pixel health"
        description="Live firing status for all client pixels. Firing = event in last 7d. Stale = event in last 30d. Dark = nothing in 30d."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Firing" value={counts.firing} tone="emerald" />
        <StatTile label="Stale" value={counts.stale} tone="amber" />
        <StatTile label="Dark" value={counts.dark} tone="rose" />
        <StatTile label="Unconfigured" value={counts.unconfigured} tone="neutral" />
      </div>

      <div className="border border-border bg-card rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-2.5 text-[11px] font-medium text-muted-foreground">
                  Client
                </th>
                <th className="text-left px-4 py-2.5 text-[11px] font-medium text-muted-foreground">
                  Domain
                </th>
                <th className="text-left px-4 py-2.5 text-[11px] font-medium text-muted-foreground">
                  Status
                </th>
                <th className="text-right px-4 py-2.5 text-[11px] font-medium text-muted-foreground">
                  Total events
                </th>
                <th className="text-right px-4 py-2.5 text-[11px] font-medium text-muted-foreground">
                  Last event
                </th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.orgId} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/clients/${r.orgId}`}
                      className="font-medium text-foreground hover:text-primary transition-colors"
                    >
                      {r.org.name}
                    </Link>
                    <div className="text-[11px] text-muted-foreground">{r.org.slug}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {r.installedOnDomain ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <PixelStatusBadge status={r.pixelStatus} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-sm text-foreground">
                    {r.totalEventsCount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-muted-foreground whitespace-nowrap">
                    {r.lastEventAt
                      ? formatDistanceToNow(r.lastEventAt, { addSuffix: true })
                      : "Never"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/clients/${r.orgId}`}
                      className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                    >
                      Configure
                    </Link>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No pixel integrations configured.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PixelStatusBadge({ status }: { status: "firing" | "stale" | "dark" | "unconfigured" }) {
  const styles: Record<string, string> = {
    firing: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    stale: "bg-amber-50 text-amber-700 border border-amber-200",
    dark: "bg-rose-50 text-rose-700 border border-rose-200",
    unconfigured: "bg-muted text-muted-foreground border border-border",
  };
  const labels: Record<string, string> = {
    firing: "Firing",
    stale: "Stale",
    dark: "Dark",
    unconfigured: "Unconfigured",
  };
  return (
    <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded", styles[status])}>
      {labels[status]}
    </span>
  );
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "amber" | "rose" | "neutral";
}) {
  const styles: Record<string, string> = {
    emerald: "text-emerald-700",
    amber: "text-amber-700",
    rose: "text-rose-700",
    neutral: "text-muted-foreground",
  };
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={cn("text-2xl font-semibold mt-1 tabular-nums", styles[tone])}>{value}</div>
    </div>
  );
}
