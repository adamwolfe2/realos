import { Panel, Pill } from "@/components/portal/overview/kit";

// The Monday read at the top of /portal/ads: what moved last week and the
// few decisions worth making. Written from the synced numbers (by Claude
// when available, by rules otherwise); stored as the week's
// ads_weekly_brief insight.

export type WeeklyBriefData = {
  title: string;
  body: string;
  weekStart: string | null;
  decisions: { title: string; why: string }[];
};

export function parseBriefContext(context: unknown): Pick<WeeklyBriefData, "weekStart" | "decisions"> {
  const c = (context ?? {}) as { weekStart?: unknown; decisions?: unknown };
  const decisions = Array.isArray(c.decisions)
    ? c.decisions
        .filter((d): d is { title: string; why: string } => typeof d?.title === "string" && typeof d?.why === "string")
        .slice(0, 3)
    : [];
  return { weekStart: typeof c.weekStart === "string" ? c.weekStart : null, decisions };
}

function weekLabel(iso: string | null): string {
  if (!iso) return "Last week";
  const start = new Date(`${iso}T00:00:00Z`);
  const end = new Date(start.getTime() + 6 * 86_400_000);
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${fmt(start)} to ${fmt(end)}`;
}

export function WeeklyBrief({ brief }: { brief: WeeklyBriefData }) {
  return (
    <Panel
      title="This week's read"
      aside={
        <span className="inline-flex items-center gap-2">
          <Pill tone="ai">Written from your numbers</Pill>
          <span>{weekLabel(brief.weekStart)}</span>
        </span>
      }
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <p className="text-[17px] font-semibold leading-snug text-[var(--t-ink)]">{brief.title}</p>
          <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--t-text)]">{brief.body}</p>
        </div>
        {brief.decisions.length ? (
          <div className="lg:border-l lg:border-[var(--t-divider)] lg:pl-6">
            <p className="ls-eyebrow mb-2">Worth deciding this week</p>
            <ol className="space-y-3">
              {brief.decisions.map((d, i) => (
                <li key={d.title} className="flex gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--t-accent-soft)] text-[11px] font-semibold text-[var(--t-accent)]">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-[var(--t-ink)]">{d.title}</p>
                    <p className="mt-0.5 text-[12.5px] leading-relaxed text-[var(--t-muted)]">{d.why}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
