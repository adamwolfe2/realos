// Lead -> tour -> lease as three bars sized against leads, with the step
// conversion between them. Plain markup so server and client pages share it.

const STEPS = [
  { key: "leads", label: "Leads", color: "#93b4ff" },
  { key: "tours", label: "Tours", color: "#4f7cf7" },
  { key: "signed", label: "Leases", color: "#15803d" },
] as const;

type Funnel = { leads: number; tours: number; signed: number };

export function FunnelBar({ funnel }: { funnel: Funnel }) {
  if (funnel.leads === 0) return null;
  return (
    <div className="grid gap-3 rounded-[var(--t-radius-sm)] border border-[var(--t-border)] bg-white p-4 sm:grid-cols-3">
      {STEPS.map((s, i) => {
        const value = funnel[s.key];
        const prev = i ? funnel[STEPS[i - 1].key] : 0;
        return (
          <div key={s.key}>
            <div className="flex items-baseline justify-between gap-2 text-[12.5px]">
              <span className="text-[var(--t-muted)]">{s.label}</span>
              {i ? (
                <span className="tabular-nums text-[var(--t-muted)]">{prev ? `${Math.round((value / prev) * 100)}% of ${STEPS[i - 1].label.toLowerCase()}` : "—"}</span>
              ) : null}
            </div>
            <div className="mt-1 text-[20px] font-semibold tabular-nums text-[var(--t-ink)]">{value.toLocaleString()}</div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[var(--t-wash)]" aria-hidden>
              <div className="h-full rounded-full" style={{ width: `${(value / funnel.leads) * 100}%`, background: s.color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
