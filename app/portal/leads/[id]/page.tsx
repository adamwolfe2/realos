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
import { LeadEmailComposer } from "@/components/portal/leads/email-composer";
import { ReviewRequestButton } from "@/components/portal/leads/review-request-button";
import { LeadSmsComposer } from "@/components/portal/leads/sms-composer";
import { isSmsConfigured } from "@/lib/sms/twilio";
import { InsightCard, type InsightCardData } from "@/components/portal/insights/insight-card";
import { MarkLostButton } from "./mark-lost-button";
import {
  LeadConversationPanel,
  type LeadConversationMessage,
} from "@/components/portal/leads/lead-conversation-panel";
import type { Prisma } from "@prisma/client";

export const metadata: Metadata = { title: "Lead detail" };
export const dynamic = "force-dynamic";

// Defensive parser for the ChatbotConversation.messages JSON column. The
// shape is {role, content, ts?} per message, but stored as Prisma.JsonValue
// so we coerce safely — a malformed row should NOT crash the lead detail.
function parseConversationMessages(
  raw: Prisma.JsonValue,
): LeadConversationMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: LeadConversationMessage[] = [];
  for (const item of raw) {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const rec = item as Record<string, unknown>;
      const role = typeof rec.role === "string" ? rec.role : "assistant";
      const content = typeof rec.content === "string" ? rec.content : "";
      if (!content) continue;
      const ts = typeof rec.ts === "string" ? rec.ts : undefined;
      out.push({ role, content, ts });
    }
  }
  return out;
}

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
      property: {
        select: { id: true, name: true, googleReviewUrl: true },
      },
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

  // Conversation discovery — primary path is lead.conversations (the
  // FK relation set during chatbot capture). For historical leads from
  // before the FK was always written, OR for leads imported from forms
  // that match a chatbot conversation by email later, also pull any
  // ChatbotConversation where capturedEmail matches and leadId is null.
  // Result is unioned + de-duped so the lead detail surface stays
  // complete even when the back-end link wasn't established.
  const orphanedConversations =
    lead.email && lead.conversations.length === 0
      ? await prisma.chatbotConversation.findMany({
          where: {
            orgId: scope.orgId,
            leadId: null,
            capturedEmail: { equals: lead.email, mode: "insensitive" },
          },
          orderBy: { lastMessageAt: "desc" },
          take: 5,
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
        })
      : [];
  const allConversations = [...lead.conversations, ...orphanedConversations];

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

  // Audit BUG #8: previously read lead.updatedAt which Prisma's @updatedAt
  // decorator auto-touches on every write — including the lead-score
  // cron that ticks every 30 min. Operators saw "Updated 13 min ago"
  // immediately after opening a lead and assumed their click had
  // triggered the update. lastActivityAt only ticks on real activity
  // (status changes, notes, emails sent) so this now accurately
  // reflects human edits.
  const timeInStatus = formatDistanceToNow(lead.lastActivityAt, {
    addSuffix: true,
  });
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
          <LeadEmailComposer
            leadId={lead.id}
            to={lead.email}
            unsubscribed={lead.unsubscribedFromEmails}
            defaultSubject={`Following up on your interest in ${
              lead.property?.name ?? "our properties"
            }`}
          />
          <LeadSmsComposer
            leadId={lead.id}
            to={lead.phone}
            smsEnabled={isSmsConfigured()}
          />
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

            {/* Chip row — only renders chips for fields that actually
                have values. Empty fields collapse into a single trailing
                "Missing: phone, move-in, budget" indicator. Audit BUG #9
                caught the prior placeholder chips ("No phone",
                "Move-in —") which read as broken software. */}
            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              {lead.email ? (
                <Chip icon={<Mail className="h-3 w-3" />}>{lead.email}</Chip>
              ) : null}
              {lead.phone ? (
                <Chip icon={<Phone className="h-3 w-3" />}>{lead.phone}</Chip>
              ) : null}
              <Chip icon={<Radar className="h-3 w-3" />}>
                {lead.source}
                {lead.sourceDetail ? ` \u00b7 ${lead.sourceDetail}` : ""}
              </Chip>
              {lead.desiredMoveIn ? (
                <Chip icon={<Calendar className="h-3 w-3" />}>
                  {`Move-in ${format(lead.desiredMoveIn, "MMM d, yyyy")}`}
                </Chip>
              ) : null}
              {lead.budgetMinCents != null || lead.budgetMaxCents != null ? (
                <Chip icon={<DollarSign className="h-3 w-3" />}>
                  {formatBudget(lead.budgetMinCents, lead.budgetMaxCents)}
                </Chip>
              ) : null}
              {lead.property?.name ? (
                <Chip icon={<Home className="h-3 w-3" />}>
                  {lead.property.name}
                </Chip>
              ) : null}
              <MissingFieldsChip
                missing={
                  [
                    !lead.email && "email",
                    !lead.phone && "phone",
                    !lead.desiredMoveIn && "move-in",
                    lead.budgetMinCents == null &&
                      lead.budgetMaxCents == null &&
                      "budget",
                  ].filter((v): v is string => typeof v === "string")
                }
              />
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
              Last activity {timeInStatus}
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
          <Tile label="Channel cost">
            <ChannelCostBlock source={lead.source} propertyId={lead.propertyId} />
          </Tile>
        </div>
      </section>

      {/* C + D. Timeline + sidebar */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Timeline (2 cols on desktop) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Chatbot conversation — surfaced inline so operators don't
              have to navigate to /portal/conversations to see what the
              prospect actually asked. The component handles the
              "multiple conversations per lead" case by inlining the most
              recent and deep-linking the earlier ones. Includes orphaned
              matches (capturedEmail == lead.email but leadId never set
              on the conversation row — historical data resilience). */}
          {allConversations.length > 0 ? (
            <LeadConversationPanel
              conversations={allConversations.map((c) => ({
                id: c.id,
                status: c.status,
                messageCount: c.messageCount,
                lastMessageAt: c.lastMessageAt,
                createdAt: c.createdAt,
                pageUrl: c.pageUrl,
                capturedEmail: c.capturedEmail,
                capturedName: c.capturedName,
                messages: parseConversationMessages(c.messages),
              }))}
            />
          ) : null}

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
                      {n.body.replace(/^\[lead:[^\]]+\]\s*/, "")}
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
              <ReviewRequestButton
                leadId={lead.id}
                alreadySentAt={
                  lead.reviewRequestSentAt
                    ? lead.reviewRequestSentAt.toISOString()
                    : null
                }
                hasEmail={Boolean(lead.email)}
                hasReviewUrl={Boolean(lead.property?.googleReviewUrl)}
                unsubscribed={lead.unsubscribedFromEmails}
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

// Compact pill that lists which lead fields are still empty. Replaces the
// previous pattern of rendering placeholder chips ("No phone",
// "Move-in —") which looked like the platform was broken. Shows nothing
// when all fields are populated. (audit BUG #9)
function MissingFieldsChip({ missing }: { missing: string[] }) {
  if (missing.length === 0) return null;
  const summary = missing.join(", ");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs",
        "bg-muted/40 text-muted-foreground",
        "ring-1 ring-border"
      )}
      title={`Lead is missing: ${summary}`}
    >
      <span className="text-[10px] font-semibold tracking-wider uppercase">
        Missing
      </span>
      <span className="truncate max-w-[14rem]">{summary}</span>
    </span>
  );
}

// ChannelCostBlock — replaces the dead "Cost to acquire — / Link an
// ad account to attribute" placeholder. Reads the lead's source and
// shows a meaningful classification without needing live ad-spend
// data: paid channels deep-link to the property's ad report (where
// CPL is computed), organic / direct / chatbot show "$0 channel
// cost — earned" so operators see the value of free channels
// instead of an empty tile.
function ChannelCostBlock({
  source,
  propertyId,
}: {
  source: string;
  propertyId: string | null;
}) {
  const paid = source === "GOOGLE_ADS" || source === "META_ADS";
  if (paid) {
    return (
      <>
        <p className="text-xl font-semibold tabular-nums text-foreground">
          Paid
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground leading-snug">
          {source === "GOOGLE_ADS" ? "Google Ads" : "Meta Ads"}{" "}
          attribution.{" "}
          {propertyId ? (
            <Link
              href={`/portal/properties/${propertyId}?tab=ads`}
              className="text-foreground underline underline-offset-2 hover:no-underline"
            >
              See property CPL →
            </Link>
          ) : (
            <span>Set property to attribute</span>
          )}
        </p>
      </>
    );
  }
  const earned =
    source === "ORGANIC" ||
    source === "REFERRAL" ||
    source === "DIRECT" ||
    source === "CHATBOT" ||
    source === "FORM" ||
    source === "PIXEL_OUTREACH";
  if (earned) {
    return (
      <>
        <p className="text-xl font-semibold tabular-nums text-foreground">
          $0
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {source === "CHATBOT"
            ? "Earned · chatbot capture"
            : source === "FORM"
              ? "Earned · web form"
              : source === "REFERRAL"
                ? "Earned · referral"
                : source === "PIXEL_OUTREACH"
                  ? "Earned · pixel outreach"
                  : source === "DIRECT"
                    ? "Earned · direct"
                    : "Earned · organic"}
        </p>
      </>
    );
  }
  return (
    <>
      <p className="text-xl font-semibold tabular-nums text-foreground">
        &mdash;
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        No channel attribution
      </p>
    </>
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
          "text-muted-foreground cursor-not-allowed"
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
