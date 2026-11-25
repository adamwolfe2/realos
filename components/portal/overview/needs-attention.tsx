import Link from "next/link";
import { ChevronRight, Clock, MessageCircleQuestion, MousePointerClick, Plug, TrendingDown, TriangleAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AttentionItem, AttentionKind } from "@/lib/portal/needs-attention";

// Today: what needs attention across the portfolio, highest first. Each row
// names the property, the problem, its source, and opens the section of the
// property page that shows it.

const ICON: Record<AttentionKind, LucideIcon> = {
  sync: TriangleAlert,
  "stale-units": Clock,
  "traffic-no-leads": MousePointerClick,
  unanswered: MessageCircleQuestion,
  "rank-drop": TrendingDown,
  "missing-source": Plug,
};

const SHOWN = 6;

export function NeedsAttention({ items }: { items: AttentionItem[] }) {
  if (!items.length) {
    return (
      <section className="rounded-[var(--t-radius)] border border-[var(--t-border)] bg-[var(--t-card)] px-4 py-3 text-[13px] text-[var(--t-muted)] shadow-[var(--t-shadow)]">
        Nothing needs attention today.
      </section>
    );
  }
  const head = items.slice(0, SHOWN);
  const rest = items.slice(SHOWN);
  return (
    <section className="rounded-[var(--t-radius)] border border-[var(--t-border)] bg-[var(--t-card)] shadow-[var(--t-shadow)]" aria-labelledby="needs-attention">
      <header className="flex h-11 items-center justify-between gap-3 border-b border-[var(--t-divider)] px-4">
        <h2 id="needs-attention" className="text-[13.5px] font-semibold text-[var(--t-ink)]">Needs attention</h2>
        <span className="text-[12.5px] text-[var(--t-muted)]">{items.length} item{items.length === 1 ? "" : "s"} · highest first</span>
      </header>
      <Rows items={head} />
      {rest.length ? (
        <details className="group border-t border-[var(--t-divider)]">
          <summary className="cursor-pointer list-none px-4 py-2.5 text-[12.5px] text-[var(--t-accent)] hover:underline group-open:hidden">Show {rest.length} more</summary>
          <Rows items={rest} />
        </details>
      ) : null}
    </section>
  );
}

function Rows({ items }: { items: AttentionItem[] }) {
  return (
    <ul className="grid lg:grid-cols-2 [&>li]:border-[var(--t-divider)] [&>li:not(:last-child)]:border-b lg:[&>li:nth-child(odd)]:border-r lg:[&>li:nth-last-child(2):nth-child(odd)]:border-b-0">
      {items.map((it) => {
        const Icon = ICON[it.kind];
        return (
          <li key={it.id} className="min-w-0">
            <Link href={it.href} className="group flex min-w-0 items-start gap-3 px-4 py-3 outline-none hover:bg-[var(--t-wash)] focus-visible:bg-[var(--t-wash)]">
              <Icon aria-hidden className={cn("mt-0.5 h-4 w-4 shrink-0", it.kind === "sync" ? "text-[#b91c1c]" : "text-[var(--t-muted)]")} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-[var(--t-ink)]">
                  {it.propertyName ? <span className="font-medium">{it.propertyName}: </span> : null}
                  {it.title}
                </span>
                <span className="mt-0.5 block truncate text-[12px] text-[var(--t-muted)]" title={it.detail}>{it.detail}</span>
                <span className="mt-0.5 block text-[11px] text-[var(--t-muted)]">{it.source}</span>
              </span>
              <ChevronRight aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-[var(--t-muted)] group-hover:text-[var(--t-ink)]" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
