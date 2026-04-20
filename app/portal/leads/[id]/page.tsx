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
  MoreHorizontal,
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
      body: { contains: lead.id },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

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
            className="inline-flex items-center gap-1 text-[var(--stone-gray)] hover:text-[var(--near-black)] transition-colors duration-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Leads
          </Link>
          <span className="text-[var(--stone-gray)]">/</span>
          <span className="text-[var(--near-black)] font-medium truncate max-w-[18rem]">
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
                "bg-[var(--ivory)] ring-1 ring-[var(--border-cream)]",
                "text-[var(--charcoal-warm)]",
                "transition-colors duration-200",
                "hover:bg-[var(--warm-sand)] hover:text-[var(--near-black)]"
              )}
            >
              <Send className="h-4 w-4" />
            </a>
          ) : null}
          <button
            type="button"
            aria-label="More actions"
            title="More actions"
            className={cn(
              "inline-flex h-9 w-9 items-center justify-center rounded-[10px]",
              "bg-[var(--ivory)] ring-1 ring-[var(--border-cream)]",
              "text-[var(--charcoal-warm)]",
              "transition-colors duration-200",
              "hover:bg-[var(--warm-sand)] hover:text-[var(--near-black)]"
            )}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* B. Hero identity card */}
      <section
        className={cn(
          "rounded-[12px] border border-[var(--border-cream)] bg-[var(--ivory)]",
          "p-6 md:p-7",
          "grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,auto)] gap-6"
        )}
      >
        {/* Identity block */}
        <div className="flex items-start gap-5 min-w-0">
          {logoUrl ? (
            <div className="h-14 w-14 shrink-0 rounded-[12px] bg-[var(--white)] ring-1 ring-[var(--border-cream)] overflow-hidden flex items-center justify-center">
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
              <span className="text-sm font-medium text-[var(--near-black)]">
                {humanizeStatus(lead.status)}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-[var(--stone-gray)]">
              Updated {timeInStatus}
            </p>
          </Tile>
          <Tile label="Intent">
            <p className="text-xl font-semibold tabular-nums text-foreground">
              {lead.score}
              <span className="text-sm text-[var(--stone-gray)] font-sans">
                {" "}
                / 100
              </span>
            </p>
            <div className="mt-2 h-1.5 w-full rounded-full bg-[var(--warm-sand)] overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--terracotta)] transition-all"
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
            <p className="mt-1 text-[11px] text-[var(--stone-gray)]">
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
            <p className="text-xs text-[var(--stone-gray)]">
              {timeline.length} {timeline.length === 1 ? "event" : "events"}
            </p>
          </div>
          <div className="rounded-[12px] border border-[var(--border-cream)] bg-[var(--ivory)] p-4">
            <Timeline events={timeline} />
          </div>
          {timeline.length === 1 ? (
            <p className="text-xs text-[var(--stone-gray)] px-2">
              This lead is new. Future touchpoints &mdash; pixel visits, chats,
              tours, signed leases &mdash; will appear here as they happen.
            </p>
          ) : null}
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
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
              <p className="mt-3 text-xs text-[var(--stone-gray)]">
                No notes yet.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {notes.map((n) => (
                  <li
                    key={n.id}
                    className="rounded-[10px] bg-[var(--parchment)] ring-1 ring-[var(--border-cream)] p-3"
                  >
                    <p className="text-xs text-[var(--near-black)] whitespace-pre-wrap leading-relaxed">
                      {n.body}
                    </p>
                    <p className="mt-2 text-[10px] text-[var(--stone-gray)]">
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
              <button
                type="button"
                title="Coming soon"
                className={cn(
                  "w-full text-left rounded-[10px] px-3 py-2 text-xs font-medium",
                  "text-[var(--error)] bg-[var(--parchment)] ring-1 ring-[var(--border-cream)]",
                  "opacity-60 cursor-not-allowed"
                )}
              >
                Mark as lost
              </button>
            </div>
          </SidebarCard>
        </aside>
      </section>

      {/* E. Footer strip */}
      <footer className="text-[11px] text-[var(--stone-gray)] pt-2 border-t border-[var(--border-cream)]">
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
        "bg-[var(--parchment)] text-[var(--charcoal-warm)]",
        "ring-1 ring-[var(--border-cream)]"
      )}
    >
      {icon ? (
        <span className="text-[var(--stone-gray)]">{icon}</span>
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
    <div className="rounded-[10px] border border-[var(--border-cream)] bg-[var(--parchment)] p-4">
      <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--stone-gray)] mb-2">
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
        return "bg-[var(--terracotta)]";
      default:
        return "bg-[var(--stone-gray)]";
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
      <p className="text-xs text-[var(--stone-gray)]">
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
      <dt className="text-[var(--stone-gray)]">{k}</dt>
      <dd className="text-right text-[var(--near-black)] truncate">
        {v && v !== "\u2014" ? v : (
          <span className="text-[var(--stone-gray)]">&mdash;</span>
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
    "bg-[var(--parchment)] ring-1 ring-[var(--border-cream)]",
    "transition-colors duration-200"
  );
  if (!href) {
    return (
      <div
        className={cn(
          base,
          "text-[var(--stone-gray)] opacity-60 cursor-not-allowed"
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
        "text-[var(--near-black)] hover:bg-[var(--warm-sand)]"
      )}
    >
      {icon}
      {label}
    </a>
  );
}
