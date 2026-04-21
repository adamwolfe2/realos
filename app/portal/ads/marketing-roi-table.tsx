import * as React from "react";

// Marketing ROI attribution table — server component.
// Shows the full funnel by channel: spend → leads → apps → signed,
// with cost-per-lead and cost-per-signed calculated.

export type RoiRow = {
  channel: string;
  spendCents: number;
  leads: number;
  applications: number;
  signed: number;
};

function fmt$(cents: number): string {
  if (cents === 0) return "—";
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

function fmtCpl(spendCents: number, count: number): string {
  if (spendCents === 0 || count === 0) return "—";
  return `$${Math.round(spendCents / 100 / count).toLocaleString()}`;
}

function pct(num: number, denom: number): string {
  if (denom === 0) return "—";
  return `${Math.round((num / denom) * 100)}%`;
}

export function MarketingRoiTable({ rows }: { rows: RoiRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-xs text-[var(--stone-gray)]">
        No lead data yet. Attribution will appear once leads start coming in.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto -mx-5 px-5">
      <table className="w-full text-sm">
        <thead className="text-[10px] tracking-widest uppercase text-[var(--stone-gray)]">
          <tr>
            <th className="text-left font-semibold pb-2 pr-4">Channel</th>
            <th className="text-right font-semibold pb-2 px-3">Spend</th>
            <th className="text-right font-semibold pb-2 px-3">Leads</th>
            <th className="text-right font-semibold pb-2 px-3">Apps</th>
            <th className="text-right font-semibold pb-2 px-3">Signed</th>
            <th className="text-right font-semibold pb-2 px-3">CPL</th>
            <th className="text-right font-semibold pb-2 pl-3">App rate</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-cream)]">
          {rows.map((r) => (
            <tr key={r.channel} className="hover:bg-[var(--warm-sand)]/40 transition-colors">
              <td className="py-2.5 pr-4 text-xs font-medium text-[var(--near-black)]">
                {r.channel}
              </td>
              <td className="py-2.5 px-3 text-right tabular-nums text-xs text-[var(--olive-gray)]">
                {fmt$(r.spendCents)}
              </td>
              <td className="py-2.5 px-3 text-right tabular-nums text-xs font-semibold text-[var(--near-black)]">
                {r.leads.toLocaleString()}
              </td>
              <td className="py-2.5 px-3 text-right tabular-nums text-xs text-[var(--near-black)]">
                {r.applications.toLocaleString()}
              </td>
              <td className="py-2.5 px-3 text-right tabular-nums text-xs text-[var(--near-black)]">
                {r.signed > 0 ? (
                  <span className="text-emerald-700 font-semibold">{r.signed}</span>
                ) : "—"}
              </td>
              <td className="py-2.5 px-3 text-right tabular-nums text-xs text-[var(--olive-gray)]">
                {fmtCpl(r.spendCents, r.leads)}
              </td>
              <td className="py-2.5 pl-3 text-right tabular-nums text-xs text-[var(--olive-gray)]">
                {pct(r.applications, r.leads)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
