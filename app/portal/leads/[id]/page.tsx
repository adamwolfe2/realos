import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { formatDistanceToNow, format } from "date-fns";
import {
  ArrowLeft,
  Calendar,
  DollarSign,
  Home,
  Mail,
  Phone,
  Radar,
  Send,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { avatarPaletteFor, extractIdentity } from "@/lib/visitors/enrichment";
import { cn } from "@/lib/utils";
import { AddNoteForm } from "./add-note-form";
import { LeadStatusForm } from "./lead-status-form";
import { Timeline } from "@/components/portal/leads/timeline";
import { buildTimeline } from "@/components/portal/leads/timeline-events";
import { EnrichmentCard, SidebarCard } from "@/components/portal/leads/enrichment-card";
import { CopyButton } from "@/components/portal/leads/copy-button";
import { InsightCard, type InsightCardData } from "@/components/portal/insights/insight-card";
import { MarkLostButton } from "./mark-lost-button";

export const metadata: Metadata = { title: "Lead detail" };
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Lead detail — "the Loom money shot".
// One page that proves consolidation: pixel → chatbot → tour → lease.
// ---------------------------------------------------------------------------

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const scope = await requireScope();
  const { id } = await params;

  const lead = await prisma.lead.findFirst({
    where: { id, ...tenantWhere(scope) },
    include: {
      property: { select: { id: true, name: true } },
      tours: { orderBy: { scheduledAt: "desc" } },
      applications: { orderBy: { createdAt: "desc" } },
      conversations: {
        orderBy: { lastMessageAt: "desc" },
        select: {
          id: true,
          status: true,
          messages: true,
          messageCount: true,
          lastMessageAt: true,
          createdAt: true,
          capturedEmail: true,
          capturedName: true,
          pageUrl: true,
        },
      },
      visitor: true,
    },
  });
  if (!lead) notFound();

  const notes = await prisma.clientNote.findMany({
    where: {
      orgId: scope.orgId,
      noteType: "LEAD_INTERACTION",
      body: { startsWith: `[lead:${lead.id}]` },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  // Insights flagged for this specific lead (pipeline_stall, hot_visitor, etc.)
  // Also include org-wide insights with no entity binding that are still open,
  // but only if they could be the reason we're on this page (capped to 3).
  const leadInsights = await prisma.insight.findMany({
    where: {
      orgId: scope.orgId,
      entityType: "lead",
      entityId: lead.id,
      status: { in: ["open", "acknowledged"] },
    },
    orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      kind: true,
      category: true,
      severity: true,
      status: true,
      title: true,
      body: true,
      suggestedAction: true,
      href: true,
      context: true,
      createdAt: true,
      property: { select: { id: true, name: true } },
    },
  });
  const leadInsightCards: InsightCardData[] = leadInsights.map((i) => ({
    ...i,
    context: (i.context as Record<string, unknown>) ?? null,
  }));

  const displayName =
    [lead.firstName, lead.lastName].filter(Boolean).join(" ") ||
    lead.email ||
    "Anonymous lead";

  const visitorIdentity = lead.visitor ? extractIdentity(lead.visitor) : null;
  const logoUrl = visitorIdentity?.logoUrl ?? null;

  const initials = (() => {
    const a = (lead.firstName?.[0] ?? "").toUpperCase();
    const b = (lead.lastName?.[0] ?? "").toUpperCase();
    const combined = `${a}${b}`.trim();
    if (combined) return combined;
    const emailInitial = lead.email?.[0]?.toUpperCase();
    return emailInitial ?? "?";
  })();
  const palette = avatarPaletteFor(
    visitorIdentity?.companyDomain ?? displayName ?? lead.id
  );

  const timeline = buildTimeline({ ...lead });

  const subtitleParts: string[] = [];
  if (visitorIdentity?.jobTitle) subtitleParts.push(visitorIdentity.jobTitle);
  if (visitorIdentity?.companyName) {
    subtitleParts.push(
      visitorIdentity.jobTitle
        ? `at ${visitorIdentity.companyName}`
        : visitorIdentity.companyName
    );
  }
  if (lead.preferredUnitType) {
    subtitleParts.push(`Interested in ${lead.preferredUnitType.toLowerCase()}`);
  }
  if (visitorIdentity?.location) {
    subtitleParts.push(`Lives in ${visitorIdentity.location}`);
  } else if (lead.property?.name) {
    subtitleParts.push(lead.property.name);
  }
  const subtitle = subtitleParts.join(" \u00b7 ");

  const timeInStatus = formatDistanceToNow(lead.updatedAt, { addSuffix: true });
  const lastActivity = formatDistanceToNow(lead.lastActivityAt, {
    addSuffix: true,
  });
  const createdLabel = formatDistanceToNow(lead.createdAt, { addSuffix: true });

  return (
    <div className="space-y-8 pb-12">
      {/* A. Breadcrumb + actions */}
      <div className="flex items-center justify-between gap-3">
        <nav className="flex items-center gap-2 text-sm">
          <Link
            href="/portal/leads"
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors duration-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Leads
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-foreground font-medium truncate max-w-[18rem]">
            {displayName}
          </span>
        </nav>
        <div className="flex items-center gap-2">
          <CopyButton value={lead.email} label="Copy email" />
          {lead.email ? (
            <a
              href={`mailto:${lead.email}`}
              aria-label="Send email"
              title="Send email"
              className={cn(
                "inline-flex h-9 w-9 items-center justify-center rounded-[10px]",
                "bg-card ring-1 ring-border",
                "text-foreground",
                "transition-colors duration-200",
                "hover:bg-muted hover:text-foreground"
              )}
            >
              <Send className="h-4 w-4" />
            </a>
          ) : null}
        </div>
      </div>

      {/* B. Hero identity card */}
      <section
        className={cn(
          "rounded-[12px] border border-border bg-card",
          "p-6 md:p-7",
          "grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,auto)] gap-6"
        )}
      >
        {/* Identity block */}
        <div className="flex items-start gap-5 min-w-0">
          {logoUrl ? (
            <div className="h-14 w-14 shrink-0 rounded-[12px] bg-card ring-1 ring-border overflow-hidden flex items-center justify-center">
              <Image
                src={logoUrl}
                alt={visitorIdentity?.companyName ?? displayName}
                width={56}
                height={56}
                className="h-14 w-14 object-contain"
                unoptimized
              />
            </div>
          ) : (
            <div
              className={cn(
                "h-14 w-14 shrink-0 rounded-[12px] flex items-center justify-center",
                "text-lg font-semibold",
                palette
              )}
            >
              {initials}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground leading-tight">
              {displayName}
            </h1>
            {subtitle ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {subtitle}
              </p>
            ) : null}

            {/* Chip row */}
            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              <Chip icon={<Mail className="h-3 w-3" />}>
                {lead.email ?? "No email"}
              </Chip>
              <Chip icon={<Phone className="h-3 w-3" />}>
                {lead.phone ?? "No phone"}
              </Chip>
              <Chip icon={<Radar className="h-3 w-3" />}>
                {lead.source}
                {lead.sourceDetail ? ` \u00b7 ${lead.sourceDetail}` : ""}
              </Chip>
              <Chip icon={<Calendar className="h-3 w-3" />}>
                {lead.desiredMoveIn
                  ? `Move-in ${format(lead.desiredMoveIn, "MMM d, yyyy")}`
                  : "Move-in —"}
              </Chip>
              <Chip icon={<DollarSign className="h-3 w-3" />}>
                {formatBudget(lead.budgetMinCents, lead.budgetMaxCents)}
              </Chip>
              {lead.property?.name ? (
                <Chip icon={<Home className="h-3 w-3" />}>
                  {lead.property.name}
                </Chip>
              ) : null}
            </div>
          </div>
        </div>

        {/* Summary tiles */}
        <div className="grid grid-cols-3 gap-3 min-w-[22rem]">
          <Tile label="Status">
            <div className="flex items-center gap-2">
              <StatusDot status={lead.status} />
              <span className="text-sm font-medium text-foreground">
                {humanizeStatus(lead.status)}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Updated {timeInStatus}
            </p>
          </Tile>
          <Tile label="Intent">
            <p className="text-xl font-semibold tabular-nums text-foreground">
              {lead.score}
              <span className="text-sm text-muted-foreground font-sans">
                {" "}
                / 100
              </span>
            </p>
            <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{
                  width: `${Math.max(0, Math.min(100, lead.score))}%`,
                }}
              />
            </div>
          </Tile>
          <Tile label="Cost to acquire">
            <p className="text-xl font-semibold tabular-nums text-foreground">
              &mdash;
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Link an ad account to attribute
            </p>
          </Tile>
        </div>
      </section>

      {/* C + D. Timeline + sidebar */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Timeline (2 cols on desktop) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Activity
            </h2>
            <p className="text-xs text-muted-foreground">
              {timeline.length} {timeline.length === 1 ? "event" : "events"}
            </p>
          </div>
          <div className="rounded-[12px] border border-border bg-card p-4">
            <Timeline events={timeline} />
          </div>
          {timeline.length === 1 ? (
            <p className="text-xs text-muted-foreground px-2">
              This lead is new. Future touchpoints &mdash; pixel visits, chats,
              tours, signed leases &mdash; will appear here as they happen.
            </p>
          ) : null}
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          {leadInsightCards.length > 0 ? (
            <SidebarCard label="Signals">
              <div className="space-y-2">
                {leadInsightCards.map((insight) => (
                  <InsightCard key={insight.id} insight={insight} dense />
                ))}
              </div>
            </SidebarCard>
          ) : null}

          <EnrichmentCard visitor={lead.visitor} />

          <SidebarCard label="Preferences">
            <PreferenceList
              desiredMoveIn={lead.desiredMoveIn}
              budgetMinCents={lead.budgetMinCents}
              budgetMaxCents={lead.budgetMaxCents}
              preferredUnitType={lead.preferredUnitType}
            />
          </SidebarCard>

          <SidebarCard label="Status">
            <LeadStatusForm
              leadId={lead.id}
              initialStatus={lead.status}
              score={lead.score}
            />
          </SidebarCard>

          <SidebarCard label="Notes">
            <AddNoteForm leadId={lead.id} />
            {notes.length === 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">
                No notes yet.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {notes.map((n) => (
                  <li
                    key={n.id}
                    className="rounded-[10px] bg-card ring-1 ring-border p-3"
                  >
                    <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                      {n.body}
                    </p>
                    <p className="mt-2 text-[10px] text-muted-foreground">
                      {format(n.createdAt, "MMM d, h:mm a")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </SidebarCard>

          <SidebarCard label="Quick actions">
            <div className="space-y-2">
              <ActionLink
                href={lead.email ? `mailto:${lead.email}` : null}
                label="Send email"
                icon={<Mail className="h-3.5 w-3.5" />}
              />
              <ActionLink
                href={lead.phone ? `tel:${lead.phone}` : null}
                label="Call"
                icon={<Phone className="h-3.5 w-3.5" />}
              />
              <MarkLostButton leadId={lead.id} />
            </div>
          </SidebarCard>
        </aside>
      </section>

      {/* E. Footer strip */}
      <footer className="text-[11px] text-muted-foreground pt-2 border-t border-border">
        <span className="font-mono">ID {lead.id}</span>
        {" \u00b7 "}
        Created {createdLabel}
        {" \u00b7 "}
        Last activity {lastActivity}
        {" \u00b7 "}
        Source {lead.source}
        {lead.convertedAt ? (
          <>
            {" \u00b7 "}
            Converted {format(lead.convertedAt, "MMM d, yyyy")}
          </>
        ) : null}
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small presentational helpers
// ---------------------------------------------------------------------------

function Chip({
  icon,
  children,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs",
        "bg-card text-foreground",
        "ring-1 ring-border"
      )}
    >
      {icon ? (
        <span className="text-muted-foreground">{icon}</span>
      ) : null}
      <span className="truncate max-w-[14rem]">{children}</span>
    </span>
  );
}

function Tile({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[10px] border border-border bg-card p-4">
      <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-muted-foreground mb-2">
        {label}
      </p>
      {children}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const tone = (() => {
    switch (status) {
      case "SIGNED":
      case "APPROVED":
      case "APPLIED":
        return "bg-[var(--success)]";
      case "LOST":
      case "UNQUALIFIED":
        return "bg-[var(--error)]";
      case "NEW":
        return "bg-primary";
      default:
        return "bg-muted-foreground";
    }
  })();
  return <span className={cn("h-2 w-2 rounded-full shrink-0", tone)} />;
}

function humanizeStatus(status: string): string {
  return status
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function PreferenceList({
  desiredMoveIn,
  budgetMinCents,
  budgetMaxCents,
  preferredUnitType,
}: {
  desiredMoveIn: Date | null;
  budgetMinCents: number | null;
  budgetMaxCents: number | null;
  preferredUnitType: string | null;
}) {
  const hasAny =
    desiredMoveIn || budgetMinCents || budgetMaxCents || preferredUnitType;
  if (!hasAny) {
    return (
      <p className="text-xs text-muted-foreground">
        No preferences captured yet.
      </p>
    );
  }
  return (
    <dl className="space-y-2 text-xs">
      <PrefRow
        k="Move-in"
        v={desiredMoveIn ? format(desiredMoveIn, "MMM d, yyyy") : null}
      />
      <PrefRow
        k="Budget"
        v={formatBudget(budgetMinCents, budgetMaxCents, true)}
      />
      <PrefRow k="Unit type" v={preferredUnitType} />
    </dl>
  );
}

function PrefRow({ k, v }: { k: string; v: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right text-foreground truncate">
        {v && v !== "\u2014" ? v : (
          <span className="text-muted-foreground">&mdash;</span>
        )}
      </dd>
    </div>
  );
}

function formatBudget(
  minCents: number | null,
  maxCents: number | null,
  strict = false
): string {
  const toUsd = (c: number | null) =>
    c == null ? null : `$${Math.round(c / 100).toLocaleString()}`;
  const min = toUsd(minCents);
  const max = toUsd(maxCents);
  if (!min && !max) return strict ? "\u2014" : "Budget \u2014";
  if (min && max) return `${min}\u2013${max}`;
  return `${min ?? max}`;
}

function ActionLink({
  href,
  label,
  icon,
}: {
  href: string | null;
  label: string;
  icon: React.ReactNode;
}) {
  const base = cn(
    "flex items-center gap-2 rounded-[10px] px-3 py-2 text-xs font-medium",
    "bg-card ring-1 ring-border",
    "transition-colors duration-200"
  );
  if (!href) {
    return (
      <div
        className={cn(
          base,
          "text-muted-foreground opacity-60 cursor-not-allowed"
        )}
      >
        {icon}
        {label}
      </div>
    );
  }
  return (
    <a
      href={href}
      className={cn(
        base,
        "text-foreground hover:bg-muted"
      )}
    >
      {icon}
      {label}
    </a>
  );
}
