import { Panel } from "@/components/portal/overview/kit";
import type { WeekRow } from "@/lib/integrations/ads-insights-math";

// Week-by-week progression on /portal/ads: spend next to what it produced
// further down the funnel. Bars are scaled per column so a week's shape
// reads at a glance without a chart library.

function dollars(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function weekLabel(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--t-wash)]" aria-hidden>
      <div className="h-full rounded-full" style={{ width: `${max ? (value / max) * 100 : 0}%`, background: color }} />
    </div>
  );
}

export function WeeklyProgress({ weeks }: { weeks: WeekRow[] }) {
  if (weeks.length === 0) return null;
  const max = {
    spend: Math.max(...weeks.map((w) => w.spendCents)),
    leads: Math.max(...weeks.map((w) => w.leads)),
    tours: Math.max(...weeks.map((w) => w.tours)),
    signed: Math.max(...weeks.map((w) => w.signed)),
  };
  const cols: { key: keyof typeof max; label: string; color: string; fmt: (w: WeekRow) => string; value: (w: WeekRow) => number }[] = [
    { key: "spend", label: "Spend", color: "#1f5eff", fmt: (w) => dollars(w.spendCents), value: (w) => w.spendCents },
    { key: "leads", label: "Leads", color: "#5b8cff", fmt: (w) => w.leads.toLocaleString(), value: (w) => w.leads },
    { key: "tours", label: "Tours", color: "#93b4ff", fmt: (w) => w.tours.toLocaleString(), value: (w) => w.tours },
    { key: "signed", label: "Leases", color: "#15803d", fmt: (w) => w.signed.toLocaleString(), value: (w) => w.signed },
  ];

  return (
    <Panel title="Week by week" aside="Spend and what it turned into, by the week the lead came in" flush className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="border-b border-[var(--t-divider)]">
          <tr className="ls-eyebrow">
            <th className="px-4 py-2 text-left">Week of</th>
            {cols.map((c) => (
              <th key={c.key} className="px-4 py-2 text-left">{c.label}</th>
            ))}
            <th className="px-4 py-2 text-right">Cost / lead</th>
            <th className="px-4 py-2 text-right">Lead to tour</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--t-divider)]">
          {weeks.map((w) => (
            <tr key={w.week}>
              <td className="whitespace-nowrap px-4 py-2.5 font-medium text-[var(--t-ink)]">{weekLabel(w.week)}</td>
              {cols.map((c) => (
                <td key={c.key} className="min-w-[110px] px-4 py-2.5 tabular-nums text-[var(--t-ink)]">
                  {c.fmt(w)}
                  <Bar value={c.value(w)} max={max[c.key]} color={c.color} />
                </td>
              ))}
              <td className="px-4 py-2.5 text-right tabular-nums text-[var(--t-text)]">
                {w.leads && w.spendCents ? dollars(Math.round(w.spendCents / w.leads)) : "—"}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums text-[var(--t-text)]">
                {w.leads ? `${Math.round((w.tours / w.leads) * 100)}%` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-[var(--t-divider)] px-4 py-2.5 text-[12px] text-[var(--t-muted)]">
        Recent weeks have had less time to tour and sign, so their later stages fill in over the following weeks.
      </p>
    </Panel>
  );
}
