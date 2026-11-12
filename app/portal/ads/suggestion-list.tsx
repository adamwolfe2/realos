import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Panel } from "@/components/portal/overview/kit";

// One line per suggestion: severity dot, property, title, link to the
// detail. Full reasoning lives on /portal/insights and the drill-down.

export type SuggestionRow = {
  id: string;
  severity: string;
  title: string;
  href: string | null;
  property: { name: string } | null;
};

const DOT: Record<string, string> = { critical: "#b91c1c", warning: "#d97706", info: "#1f5eff" };

export function SuggestionList({ items }: { items: SuggestionRow[] }) {
  if (items.length === 0) return null;
  return (
    <Panel title="Suggestions" aside={<Link href="/portal/insights" className="text-[var(--t-accent)] hover:underline underline-offset-2">All insights</Link>} flush>
      <ul className="divide-y divide-[var(--t-divider)]">
        {items.map((s) => (
          <li key={s.id}>
            <Link href={s.href ?? "/portal/insights"} className="group flex items-center gap-3 px-4 py-3 hover:bg-[var(--t-wash)]">
              <span className="mt-1.5 h-2 w-2 shrink-0 self-start rounded-full" style={{ background: DOT[s.severity] ?? DOT.info }} aria-label={s.severity} />
              <span className="min-w-0 flex-1">
                {s.property ? <span className="block truncate text-[11.5px] text-[var(--t-muted)]">{s.property.name}</span> : null}
                <span className="line-clamp-2 text-[13px] font-medium leading-snug text-[var(--t-ink)]">{s.title}</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-[var(--t-muted)] transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
