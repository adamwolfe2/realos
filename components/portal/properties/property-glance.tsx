import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { ArrowRight } from "lucide-react";

// Property "at a glance": one card per area, each with a headline number and
// the logos of the tools behind it. Clicking a card opens that area on its
// own (?tab=...), so the property page itself never becomes a wall of forms.

export type GlanceCard = {
  tab: string;
  title: string;
  value: string;
  label: string;
  marks?: ReactNode;
  /** % change vs the previous equal window; null hides it. */
  delta?: number | null;
  /** Show the change in grey (e.g. spend, where up is not simply good). */
  deltaNeutral?: boolean;
};

export function PropertyGlance({
  cards,
  propertyPath,
  windowQuery,
}: {
  cards: GlanceCard[];
  propertyPath: string;
  windowQuery: string;
}) {
  // One row whatever the count (3 or 4 cards), 2-up on phones.
  return (
    <div
      className="grid grid-cols-2 gap-3 lg:[grid-template-columns:repeat(var(--glance-n),minmax(0,1fr))]"
      style={{ "--glance-n": cards.length } as CSSProperties}
    >
      {cards.map((c) => (
        <Link
          key={c.tab}
          href={`${propertyPath}?tab=${c.tab}&${windowQuery}`}
          className="group ls-card flex flex-col justify-between gap-3 p-4 hover:border-[var(--t-accent)] sm:p-5"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-medium text-foreground">{c.title}</span>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </div>
          <div>
            <p className="flex items-baseline gap-2">
              <span className="text-[26px] font-semibold leading-none tracking-[-0.02em] text-foreground tabular-nums">{c.value}</span>
              {c.delta != null ? (
                <span
                  className={`text-[13px] font-semibold tabular-nums ${
                    c.deltaNeutral || c.delta === 0 ? "text-muted-foreground" : c.delta > 0 ? "text-[#15803d]" : "text-[#b91c1c]"
                  }`}
                >
                  {c.delta > 0 ? "+" : ""}
                  {c.delta}%
                </span>
              ) : null}
            </p>
            <p className="mt-1.5 text-[12.5px] text-muted-foreground">{c.label}</p>
          </div>
          <div className="flex h-6 items-center gap-1.5">{c.marks}</div>
        </Link>
      ))}
    </div>
  );
}
