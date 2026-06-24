import * as React from "react";
import { SourceLogo } from "@/components/portal/attribution/source-logo";
import type { ChannelPipelineRow } from "@/lib/attribution/reverse";

// ---------------------------------------------------------------------------
// ChannelPipelineTable — every lead reverse-attributed to a channel, then the
// tour → apply → sign funnel bucketed by that channel. Answers "which sources
// actually produce signed leases," not just raw lead counts.
// ---------------------------------------------------------------------------

export function ChannelPipelineTable({ rows }: { rows: ChannelPipelineRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        No leads in this window.
      </div>
    );
  }
  const maxLeads = Math.max(1, ...rows.map((r) => r.leads));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
            <th className="px-2 py-2 font-semibold">Channel</th>
            <th className="px-2 py-2 font-semibold text-right">Leads</th>
            <th className="px-2 py-2 font-semibold text-right">Toured</th>
            <th className="px-2 py-2 font-semibold text-right">Applied</th>
            <th className="px-2 py-2 font-semibold text-right">Signed</th>
            <th className="px-2 py-2 font-semibold text-right">Signed %</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.sourceId}
              className="border-b border-border/40 hover:bg-muted/30 transition-colors"
            >
              <td className="px-2 py-2">
                <span className="flex items-center gap-2">
                  <SourceLogo logo={r.logo} size={24} />
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] font-medium text-foreground">
                      {r.label}
                    </span>
                    <span className="mt-1 block h-1 w-24 rounded-full bg-muted overflow-hidden">
                      <span
                        className="block h-full rounded-full"
                        style={{
                          width: `${Math.max((r.leads / maxLeads) * 100, 4)}%`,
                          background: r.color,
                        }}
                      />
                    </span>
                  </span>
                </span>
              </td>
              <td className="px-2 py-2 text-right font-mono tabular-nums text-foreground">
                {r.leads.toLocaleString()}
              </td>
              <td className="px-2 py-2 text-right font-mono tabular-nums text-muted-foreground">
                {r.toured.toLocaleString()}
              </td>
              <td className="px-2 py-2 text-right font-mono tabular-nums text-muted-foreground">
                {r.applied.toLocaleString()}
              </td>
              <td className="px-2 py-2 text-right font-mono tabular-nums font-semibold text-foreground">
                {r.signed.toLocaleString()}
              </td>
              <td className="px-2 py-2 text-right font-mono tabular-nums text-muted-foreground">
                {r.signedRate !== null
                  ? `${(r.signedRate * 100).toFixed(1)}%`
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
