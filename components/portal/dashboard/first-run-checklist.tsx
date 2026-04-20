import * as React from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Circle,
  ArrowRight,
  Search,
  Eye,
  Building2,
  Brush,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// FirstRunChecklist
//
// Empty-state replacement for the dashboard tiles when a workspace has zero
// activity yet. Walks the operator through the four moves that unlock the
// real dashboard. Each row links to the page where the action happens.
// ---------------------------------------------------------------------------

export type ChecklistItem = {
  id: string;
  title: string;
  description: string;
  href: string;
  done: boolean;
  icon: React.ComponentType<{ className?: string }>;
};

export const DEFAULT_FIRST_RUN_ITEMS: Array<Omit<ChecklistItem, "done">> = [
  {
    id: "property",
    title: "Add your first property",
    description: "Set up the listing your campaigns and chatbot will reference.",
    href: "/portal/properties",
    icon: Building2,
  },
  {
    id: "pixel",
    title: "Install the Cursive pixel",
    description: "Identify anonymous site visitors and stream them into Leads.",
    href: "/portal/visitors",
    icon: Eye,
  },
  {
    id: "seo",
    title: "Connect Google Search Console",
    description: "Pull keyword + landing page performance into your dashboard.",
    href: "/portal/seo",
    icon: Search,
  },
  {
    id: "site",
    title: "Customize your marketing site",
    description: "Pick colors, hero copy, and amenity blocks for the public site.",
    href: "/portal/site-builder",
    icon: Brush,
  },
];

export function FirstRunChecklist({ items }: { items: ChecklistItem[] }) {
  const completed = items.filter((i) => i.done).length;
  const pct = Math.round((completed / items.length) * 100);
  return (
    <section className="rounded-xl border border-[var(--border-cream)] bg-[var(--ivory)] p-6">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <div className="text-[10px] tracking-widest uppercase font-semibold text-[var(--stone-gray)]">
            Get started
          </div>
          <h2 className="mt-1 font-serif text-2xl font-medium text-[var(--near-black)] tracking-tight">
            A few quick wins to light up your dashboard
          </h2>
          <p className="mt-1 text-sm text-[var(--olive-gray)] max-w-xl">
            Each step takes a minute or two. Once any of these are live, the
            dashboard tiles populate automatically.
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-2xl font-semibold tabular-nums text-[var(--near-black)]">
            {completed}/{items.length}
          </div>
          <div className="text-[10px] tracking-widest uppercase font-semibold text-[var(--stone-gray)]">
            Complete
          </div>
        </div>
      </div>

      <div className="mt-4 h-1.5 w-full rounded-full bg-[var(--warm-sand)] overflow-hidden">
        <div
          className="h-full rounded-full bg-[var(--terracotta)] transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ul className="mt-5 space-y-2">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <li key={it.id}>
              <Link
                href={it.href}
                className={cn(
                  "group flex items-center gap-3 rounded-lg border border-[var(--border-cream)] bg-[var(--white)] px-4 py-3 transition-colors",
                  "hover:border-[var(--terracotta)]/30",
                )}
              >
                <span
                  className={cn(
                    "shrink-0 grid place-items-center h-8 w-8 rounded-md",
                    it.done
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-[var(--warm-sand)] text-[var(--charcoal-warm)]",
                  )}
                >
                  {it.done ? (
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div
                    className={cn(
                      "text-sm font-medium",
                      it.done
                        ? "text-[var(--stone-gray)] line-through"
                        : "text-[var(--near-black)]",
                    )}
                  >
                    {it.title}
                  </div>
                  <p className="text-xs text-[var(--olive-gray)] mt-0.5">
                    {it.description}
                  </p>
                </div>
                {it.done ? (
                  <Circle className="h-4 w-4 text-[var(--ring-warm)]" aria-hidden="true" />
                ) : (
                  <ArrowRight
                    className="h-4 w-4 text-[var(--stone-gray)] group-hover:text-[var(--terracotta)] transition-colors"
                    aria-hidden="true"
                  />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
