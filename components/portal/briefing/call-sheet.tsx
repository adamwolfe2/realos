import Link from "next/link";
import { Flame, Hourglass, Sparkle, Phone, Mail, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CallPriorityLead } from "@/lib/briefing/queries";

const DAY = 24 * 60 * 60 * 1000;

export function CallSheet({ leads }: { leads: CallPriorityLead[] }) {
  if (leads.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-sm text-[var(--olive-gray)]">
          No priority leads right now. Every known lead is either being handled or past its window.
        </p>
      </div>
    );
  }

  return (
    <ol className="divide-y divide-[var(--border-cream)]">
      {leads.map((lead, i) => (
        <CallSheetRow key={lead.id} lead={lead} index={i + 1} />
      ))}
    </ol>
  );
}

function CallSheetRow({ lead, index }: { lead: CallPriorityLead; index: number }) {
  const name =
    [lead.firstName, lead.lastName].filter(Boolean).join(" ").trim() ||
    lead.email ||
    "Unnamed lead";

  const reason = REASON_CONFIG[lead.reason];
  const Icon = reason.icon;

  const daysOld = Math.max(
    0,
    Math.floor((Date.now() - lead.createdAt.getTime()) / DAY),
  );
  const daysSinceActivity = Math.max(
    0,
    Math.floor((Date.now() - lead.lastActivityAt.getTime()) / DAY),
  );

  return (
    <li className="group flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--warm-sand)] text-[11px] font-semibold tabular-nums text-[var(--olive-gray)]">
        {index}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/portal/leads/${lead.id}`}
            className="text-sm font-semibold tracking-tight text-[var(--near-black)] hover:text-[var(--terracotta)] transition-colors"
          >
            {name}
          </Link>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest ring-1 ring-inset",
              reason.cls,
            )}
          >
            <Icon className="h-2.5 w-2.5" />
            {reason.label}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] tabular-nums font-semibold text-[var(--stone-gray)]">
            Score {lead.score}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-2 flex-wrap text-[11px] text-[var(--stone-gray)]">
          <span className="font-medium">{lead.source.replace(/_/g, " ").toLowerCase()}</span>
          {lead.propertyName ? (
            <>
              <span className="h-0.5 w-0.5 rounded-full bg-[var(--stone-gray)]" />
              <span>{lead.propertyName}</span>
            </>
          ) : null}
          <span className="h-0.5 w-0.5 rounded-full bg-[var(--stone-gray)]" />
          <span>
            {lead.reason === "stalled"
              ? `${daysSinceActivity}d silent`
              : lead.reason === "new-high-score"
                ? `created ${daysOld}d ago`
                : `active ${daysSinceActivity}d ago`}
          </span>
        </div>
        <div className="mt-1.5 flex items-center gap-3">
          {lead.phone ? (
            <a
              href={`tel:${lead.phone}`}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--near-black)] hover:text-[var(--terracotta)]"
            >
              <Phone className="h-3 w-3" />
              {lead.phone}
            </a>
          ) : null}
          {lead.email ? (
            <a
              href={`mailto:${lead.email}`}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--olive-gray)] hover:text-[var(--terracotta)]"
            >
              <Mail className="h-3 w-3" />
              {lead.email}
            </a>
          ) : null}
          <Link
            href={`/portal/leads/${lead.id}`}
            className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-[var(--stone-gray)] opacity-0 group-hover:opacity-100 transition-opacity"
          >
            Open
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </li>
  );
}

const REASON_CONFIG: Record<
  CallPriorityLead["reason"],
  { label: string; icon: React.ComponentType<{ className?: string }>; cls: string }
> = {
  hot: {
    label: "Hot",
    icon: Flame,
    cls: "bg-rose-50 text-rose-700 ring-rose-200/70",
  },
  stalled: {
    label: "Stalled",
    icon: Hourglass,
    cls: "bg-amber-50 text-amber-800 ring-amber-200/70",
  },
  "new-high-score": {
    label: "Fresh + scored",
    icon: Sparkle,
    cls: "bg-emerald-50 text-emerald-700 ring-emerald-200/70",
  },
  "recent-chatbot": {
    label: "From chat",
    icon: Sparkle,
    cls: "bg-sky-50 text-sky-700 ring-sky-200/70",
  },
};
