import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { formatDistanceToNow, format } from "date-fns";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { propertyOrOrgLevelWhereFragment } from "@/lib/tenancy/property-filter";
import { VisitorIdentificationStatus } from "@prisma/client";
import {
  ArrowLeft,
  MapPin,
  Mail,
  Phone,
  Briefcase,
  Building2,
  Linkedin,
  Flame,
  Zap,
  Globe,
  Clock,
  MousePointerClick,
  MessageSquare,
  Radio,
  Gauge,
} from "lucide-react";
import {
  avatarPaletteFor,
  extractIdentity,
} from "@/lib/visitors/enrichment";
import { cn } from "@/lib/utils";
import { PageHeader, SectionCard } from "@/components/admin/page-header";
import { KpiTile } from "@/components/portal/dashboard/kpi-tile";
import { StatusChip } from "@/components/portal/ui/status-chip";
import { StatusPill, type StatusTone } from "@/components/portal/ui/status-pill";
import { AlertBanner } from "@/components/portal/ui/alert-banner";
import { EngageComposer } from "../engage-composer";
import { ConvertToLeadButton } from "./convert-button";

export const metadata: Metadata = { title: "Visitor detail" };
export const revalidate = 15;

const LIVE_WINDOW_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function VisitorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const scope = await requireScope();

  const visitor = await prisma.visitor.findFirst({
    // Property-level RBAC: a scoped agent may view visitors on their own
    // properties or org-level (null-property) pixel visitors — matching
    // the convert/engage routes — but not a visitor tied to a property
    // they can't access.
    where: {
      id,
      ...tenantWhere(scope),
      ...propertyOrOrgLevelWhereFragment(scope, null),
    },
    include: {
      // Capped to the 20 most recent sessions — this page previously
      // fetched every session + every event with no limit, which was
      // unbounded on a long-lived, high-traffic visitor. The "Sessions"
      // KPI tile and timeline numbering use the real total from
      // sessionAgg below, not this array's length, so the cap never
      // makes the count lie.
      sessions: {
        orderBy: { startedAt: "desc" },
        take: 20,
        include: {
          events: {
            // Only the fields the timeline actually renders (top-pages
            // list groups by type === "pageview" and displays path).
            // occurredAt drives ordering only — Prisma can sort on it
            // without it being selected.
            select: { type: true, path: true },
            orderBy: { occurredAt: "asc" },
          },
        },
      },
    },
  });

  if (!visitor) notFound();

  // Real totals across ALL sessions for this visitor (not just the
  // capped 20 above) so the Sessions/Pageviews/Time/Scroll KPI tiles and
  // the "Session N" numbering stay truthful once the list is capped.
  const sessionAgg = await prisma.visitorSession.aggregate({
    where: { orgId: scope.orgId, visitorId: visitor.id },
    _count: { _all: true },
    _sum: { pageviewCount: true, totalTimeSeconds: true },
    _max: { maxScrollDepth: true },
  });

  const identity = extractIdentity(visitor);
  const palette = avatarPaletteFor(
    identity.companyDomain ?? identity.displayName ?? visitor.id
  );

  // Linked lead (first match by visitorId)
  const linkedLead = await prisma.lead.findFirst({
    where: { orgId: scope.orgId, visitorId: id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      status: true,
      source: true,
      createdAt: true,
    },
  });

  // Linked chatbot conversation (match by visitorHash)
  const linkedConversation = visitor.visitorHash
    ? await prisma.chatbotConversation.findFirst({
        where: { orgId: scope.orgId, visitorHash: visitor.visitorHash },
        orderBy: { lastMessageAt: "desc" },
        select: {
          id: true,
          status: true,
          messageCount: true,
          capturedName: true,
          capturedEmail: true,
          capturedPhone: true,
          lastMessageAt: true,
          pageUrl: true,
          messages: true,
        },
      })
    : null;

  // Live chat session
  const liveSession = visitor.sessions.find(
    (s) => s.lastEventAt.getTime() >= Date.now() - LIVE_WINDOW_MS
  );

  // Engagement metrics. The VisitorSession table is populated only when
  // AL/Cursive sends a page_view event, but AL-identified visitors
  // routinely arrive via identify-only events with no engagement
  // payload. Fall back to the aggregates on the Visitor record itself
  // (set by the AL identify pipeline) so a visitor with intent score 70
  // doesn't display as "0 sessions / 0 pageviews / 0s on site" — the
  // audit caught this exact dead-end on Timothy Farris.
  const sessionRowCount = sessionAgg._count._all;
  const sessionRowPageviews = sessionAgg._sum.pageviewCount ?? 0;
  const sessionRowTime = sessionAgg._sum.totalTimeSeconds ?? 0;
  const sessionRowScroll = sessionAgg._max.maxScrollDepth ?? 0;
  // Session list is capped at 20 (most recent) — flag it so the timeline
  // can disclose that older sessions exist but aren't listed.
  const sessionsCapped = sessionRowCount > visitor.sessions.length;

  // Prefer first-party session data when present (it's per-event accurate),
  // fall back to the AL-supplied Visitor-row aggregates otherwise. This
  // way the UI is always honest: it shows whichever source has higher
  // signal, never zero when AL knows otherwise.
  const totalSessions = Math.max(sessionRowCount, visitor.sessionCount ?? 0);
  const totalPageviews = Math.max(
    sessionRowPageviews,
    // AL stores recent pages in pagesViewed JSON when known; count length
    // as a soft proxy for pageviews when no per-session table exists.
    Array.isArray(visitor.pagesViewed) ? visitor.pagesViewed.length : 0
  );
  const totalTimeSeconds = Math.max(
    sessionRowTime,
    visitor.totalTimeSeconds ?? 0
  );
  const maxScrollDepth = sessionRowScroll;
  // Tells the UI whether to show a hint that engagement was synthesized
  // from AL aggregates (no per-pageview detail). Drives the "limited
  // engagement detail" copy below the metrics row.
  const usingAggregateFallback = sessionRowCount === 0 && totalSessions > 0;

  const isLive =
    visitor.sessions.some(
      (s) => s.lastEventAt.getTime() >= Date.now() - LIVE_WINDOW_MS
    );

  // UTM chip label
  const utmLabel = visitor.utmSource
    ? [visitor.utmSource, visitor.utmMedium, visitor.utmCampaign]
        .filter(Boolean)
        .join(" / ")
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        eyebrow={
          <Link
            href="/portal/visitors"
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to visitor feed
          </Link>
        }
        title={
          <span className="flex items-center gap-3 flex-wrap">
            <VisitorAvatar identity={identity} visitorId={visitor.id} palette={palette} />
            <span>{identity.displayName}</span>
            {isLive ? <StatusChip status="live" label="Live now" /> : null}
          </span>
        }
        description={
          visitor.email
            ? visitor.email
            : identity.isAnonymous
            ? "Anonymous visitor"
            : undefined
        }
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {/* Identification status — routed through the shared StatusPill
                primitive (components/portal/ui/status-pill.tsx) used by
                every other list/detail surface in the portal, instead of a
                bespoke pill. Label vocabulary unchanged. */}
            <StatusPill
              label={STATUS_LABEL[visitor.status]}
              tone={STATUS_TONE[visitor.status]}
            />
            {/* UTM chip */}
            {utmLabel ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted border border-border px-2 py-1 rounded-md">
                <Globe className="h-3 w-3" />
                {utmLabel}
              </span>
            ) : null}
          </div>
        }
      />

      {/* Engage button (live only) */}
      {isLive && liveSession ? (
        <div className="rounded-xl border border-primary/30 bg-primary/10 p-4">
          <div className="text-sm font-medium text-primary mb-3">
            This visitor is active right now. Send them a message and it will
            appear in the chatbot widget within seconds.
          </div>
          <EngageComposer
            visitorId={visitor.id}
            sessionId={liveSession.sessionToken}
            defaultPlaceholder={
              identity.lastPagePath
                ? `Hi! I noticed you were checking out ${identity.lastPagePath}. Anything I can help with?`
                : undefined
            }
          />
        </div>
      ) : null}

      {/* Two-column layout: identity card + engagement */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Identity card */}
        <div className="lg:col-span-1 space-y-6">
          <SectionCard label="Identity">
            <dl className="space-y-3 text-sm">
              {identity.firstName || identity.lastName ? (
                <IdentityRow label="Name">
                  {[identity.firstName, identity.lastName]
                    .filter(Boolean)
                    .join(" ")}
                </IdentityRow>
              ) : null}
              {visitor.email ? (
                <IdentityRow label="Email" icon={<Mail className="h-3.5 w-3.5" />}>
                  <a
                    href={`mailto:${visitor.email}`}
                    className="text-primary hover:underline underline-offset-2 break-all"
                  >
                    {visitor.email}
                  </a>
                </IdentityRow>
              ) : null}
              {visitor.phone ? (
                <IdentityRow label="Phone" icon={<Phone className="h-3.5 w-3.5" />}>
                  <a
                    href={`tel:${visitor.phone}`}
                    className="text-primary hover:underline underline-offset-2"
                  >
                    {visitor.phone}
                  </a>
                </IdentityRow>
              ) : null}
              {identity.jobTitle ? (
                <IdentityRow label="Title" icon={<Briefcase className="h-3.5 w-3.5" />}>
                  {identity.jobTitle}
                </IdentityRow>
              ) : null}
              {identity.companyName ? (
                <IdentityRow label="Company" icon={<Building2 className="h-3.5 w-3.5" />}>
                  {identity.logoUrl ? (
                    <span className="flex items-center gap-1.5">
                      <Image
                        src={identity.logoUrl}
                        alt={identity.companyName}
                        width={16}
                        height={16}
                        className="h-4 w-4 object-contain rounded"
                        unoptimized
                      />
                      {identity.companyName}
                    </span>
                  ) : (
                    identity.companyName
                  )}
                </IdentityRow>
              ) : null}
              {identity.location ? (
                <IdentityRow label="Location" icon={<MapPin className="h-3.5 w-3.5" />}>
                  {identity.location}
                </IdentityRow>
              ) : null}
              {/* LinkedIn from enrichedData */}
              {linkedinUrl(visitor.enrichedData) ? (
                <IdentityRow label="LinkedIn" icon={<Linkedin className="h-3.5 w-3.5" />}>
                  <a
                    href={linkedinUrl(visitor.enrichedData)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline underline-offset-2 break-all"
                  >
                    View profile
                  </a>
                </IdentityRow>
              ) : null}
              {/* First / last seen */}
              <IdentityRow label="First seen">
                {format(visitor.firstSeenAt, "MMM d, yyyy")}
              </IdentityRow>
              <IdentityRow label="Last seen">
                {formatDistanceToNow(visitor.lastSeenAt, { addSuffix: true })}
              </IdentityRow>
            </dl>

            {/* Lead link — when matched, show the link card. When not
                matched but we have an email, surface the one-click
                "Convert to lead" button so the operator can promote a
                pixel-identified visitor into a tracked Lead row
                (status MATCHED_TO_LEAD) without re-typing any data. */}
            {linkedLead ? (
              <div className="mt-4 pt-4 border-t border-border">
                <div className="text-xs text-muted-foreground mb-2">
                  Matched lead
                </div>
                <Link
                  href={`/portal/leads/${linkedLead.id}`}
                  className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 hover:bg-muted transition-colors text-sm"
                >
                  <div>
                    <div className="font-medium">
                      {[linkedLead.firstName, linkedLead.lastName]
                        .filter(Boolean)
                        .join(" ") ||
                        linkedLead.email ||
                        "Lead"}
                    </div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {linkedLead.status.toLowerCase().replace(/_/g, " ")} ·{" "}
                      {linkedLead.source.toLowerCase().replace(/_/g, " ")}
                    </div>
                  </div>
                  <span className="text-muted-foreground text-xs">View</span>
                </Link>
              </div>
            ) : (
              <div className="mt-4 pt-4 border-t border-border">
                <div className="text-xs text-muted-foreground mb-2">
                  No tracked lead yet
                </div>
                <div className="flex items-center justify-between gap-2 rounded-md border border-dashed border-border px-3 py-2.5 text-xs">
                  <span className="text-muted-foreground leading-snug">
                    {visitor.email
                      ? "Convert this pixel-identified person into a Lead row to start tracking outreach + status."
                      : "Need an email before we can mint a Lead row."}
                  </span>
                  <ConvertToLeadButton
                    visitorId={visitor.id}
                    disabled={!visitor.email}
                    disabledReason={
                      !visitor.email
                        ? "Visitor has no email — cannot create a Lead yet."
                        : undefined
                    }
                  />
                </div>
              </div>
            )}
          </SectionCard>
        </div>

        {/* Right: Engagement + Sessions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Engagement metrics — canonical KpiTile (dense density) instead
              of the legacy StatCard, matching the visitor list page. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <KpiTile
              density="dense"
              label="Sessions"
              value={totalSessions}
              hint={
                usingAggregateFallback
                  ? "From AL aggregate"
                  : "Unique visits"
              }
              icon={<Radio className="h-3.5 w-3.5" />}
            />
            <KpiTile
              density="dense"
              label="Pageviews"
              value={totalPageviews}
              hint={
                usingAggregateFallback
                  ? "Pages tracked by AL"
                  : "Across all sessions"
              }
              icon={<MousePointerClick className="h-3.5 w-3.5" />}
            />
            <KpiTile
              density="dense"
              label="Time on site"
              value={formatDuration(totalTimeSeconds)}
              hint="Total engaged time"
              icon={<Clock className="h-3.5 w-3.5" />}
            />
            <KpiTile
              density="dense"
              label="Max scroll"
              value={maxScrollDepth > 0 ? `${maxScrollDepth}%` : "—"}
              hint={
                usingAggregateFallback
                  ? "Pixel detail required"
                  : "Deepest scroll depth"
              }
              icon={<Gauge className="h-3.5 w-3.5" />}
            />
          </div>

          {/* Honest disclosure when engagement metrics come from AL's
              aggregated identify payload rather than first-party
              page_view events. Without this hint, an operator looking
              at "0% max scroll" on a 70-intent visitor would assume the
              data is broken when it's actually just unavailable. */}
          {usingAggregateFallback ? (
            <div className="rounded-xl border border-border bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">
                Engagement detail limited.
              </span>{" "}
              This visitor was identified by AL/Cursive without a matching
              first-party page_view event, so per-session timing and
              scroll depth aren&apos;t available. Install the page-view
              snippet on every property page to backfill these.
            </div>
          ) : null}

          {/* Intent score */}
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
            <div
              className={cn(
                "text-4xl font-semibold tabular-nums",
                visitor.intentScore >= 80
                  ? "text-primary"
                  : visitor.intentScore >= 60
                  ? "text-primary/70"
                  : "text-muted-foreground"
              )}
            >
              {visitor.intentScore >= 80 ? (
                <Flame className="h-6 w-6 inline mr-1" />
              ) : visitor.intentScore >= 60 ? (
                <Zap className="h-5 w-5 inline mr-1" />
              ) : null}
              {visitor.intentScore}
            </div>
            <div>
              <div className="text-sm font-medium">Intent score</div>
              <div className="text-xs text-muted-foreground">
                {visitor.intentScore >= 80
                  ? "High intent. Strong buying signal."
                  : visitor.intentScore >= 60
                  ? "Moderate intent. Worth engaging."
                  : "Low intent. Still warming up."}
              </div>
            </div>
          </div>

          {/* Session timeline */}
          <SectionCard label="Session timeline" padded={false}>
            {/* Session list is capped at 20 (most recent) for perf — the
                real total comes from sessionAgg, mirroring the
                residents-page count + capped-list + note pattern. */}
            {sessionsCapped ? (
              <div className="p-4 pb-0">
                <AlertBanner severity="info">
                  Showing the most recent {visitor.sessions.length} of{" "}
                  {sessionRowCount.toLocaleString()} sessions.
                </AlertBanner>
              </div>
            ) : null}
            {visitor.sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground p-5">
                No sessions recorded yet.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {visitor.sessions.map((session, idx) => {
                  const pageviews = session.events.filter(
                    (e) => e.type === "pageview"
                  );
                  const topPages = Array.from(
                    new Set(pageviews.map((e) => e.path).filter(Boolean))
                  ).slice(0, 3) as string[];

                  const utmParts = [
                    session.utmSource,
                    session.utmMedium,
                    session.utmCampaign,
                  ]
                    .filter(Boolean)
                    .join(" / ");

                  return (
                    <li key={session.id} className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <span className="text-xs text-muted-foreground font-normal">
                            Session {totalSessions - idx}
                          </span>
                          {session.lastEventAt.getTime() >=
                          Date.now() - LIVE_WINDOW_MS ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-primary">
                              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                              Active
                            </span>
                          ) : null}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(session.startedAt, "MMM d, yyyy h:mm a")}
                          {session.endedAt
                            ? ` to ${format(session.endedAt, "h:mm a")}`
                            : session.lastEventAt > session.startedAt
                            ? ` to ${format(session.lastEventAt, "h:mm a")}`
                            : ""}
                        </div>
                      </div>

                      {/* Session stats row */}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <MousePointerClick className="h-3 w-3" />
                          {session.pageviewCount}{" "}
                          {session.pageviewCount === 1 ? "page" : "pages"}
                        </span>
                        {session.totalTimeSeconds > 0 ? (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDuration(session.totalTimeSeconds)}
                          </span>
                        ) : null}
                        {session.maxScrollDepth > 0 ? (
                          <span>{session.maxScrollDepth}% scroll</span>
                        ) : null}
                        {session.country ? (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {session.country}
                          </span>
                        ) : null}
                        {utmParts ? (
                          <span className="flex items-center gap-1">
                            <Globe className="h-3 w-3" />
                            {utmParts}
                          </span>
                        ) : null}
                      </div>

                      {/* Top pages */}
                      {topPages.length > 0 ? (
                        <ul className="space-y-0.5">
                          {topPages.map((path) => (
                            <li
                              key={path}
                              className="text-xs text-muted-foreground truncate font-mono"
                            >
                              {path}
                            </li>
                          ))}
                          {pageviews.length > topPages.length ? (
                            <li className="text-[11px] text-muted-foreground">
                              +{pageviews.length - topPages.length} more pages
                            </li>
                          ) : null}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>

          {/* Linked chatbot conversation */}
          {linkedConversation ? (
            <SectionCard
              label="Chatbot conversation"
              action={
                <Link
                  href={`/portal/conversations/${linkedConversation.id}`}
                  className="text-xs text-primary hover:underline"
                >
                  Open full conversation
                </Link>
              }
            >
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MessageSquare className="h-3.5 w-3.5" />
                    {linkedConversation.messageCount} messages
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Last active{" "}
                    {formatDistanceToNow(linkedConversation.lastMessageAt, {
                      addSuffix: true,
                    })}
                  </span>
                  <span className="text-xs text-muted-foreground capitalize">
                    {linkedConversation.status
                      .toLowerCase()
                      .replace(/_/g, " ")}
                  </span>
                </div>

                {/* Captured fields */}
                {(linkedConversation.capturedName ||
                  linkedConversation.capturedEmail ||
                  linkedConversation.capturedPhone) ? (
                  <div className="rounded-md bg-muted/50 border border-border px-3 py-2 space-y-1">
                    <div className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                      Captured
                    </div>
                    {linkedConversation.capturedName ? (
                      <div className="text-xs">
                        Name: {linkedConversation.capturedName}
                      </div>
                    ) : null}
                    {linkedConversation.capturedEmail ? (
                      <div className="text-xs">
                        Email: {linkedConversation.capturedEmail}
                      </div>
                    ) : null}
                    {linkedConversation.capturedPhone ? (
                      <div className="text-xs">
                        Phone: {linkedConversation.capturedPhone}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {/* Last few messages */}
                <ConversationPreview messages={linkedConversation.messages} />
              </div>
            </SectionCard>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Label vocabulary is unchanged from the previous bespoke pill — only the
// rendering primitive (StatusPill) and color mechanism (tone token) changed.
const STATUS_LABEL: Record<VisitorIdentificationStatus, string> = {
  [VisitorIdentificationStatus.MATCHED_TO_LEAD]: "Matched to lead",
  [VisitorIdentificationStatus.ENRICHED]: "Enriched",
  [VisitorIdentificationStatus.IDENTIFIED]: "Identified",
  [VisitorIdentificationStatus.ANONYMOUS]: "Anonymous",
};

const STATUS_TONE: Record<VisitorIdentificationStatus, StatusTone> = {
  [VisitorIdentificationStatus.MATCHED_TO_LEAD]: "success",
  [VisitorIdentificationStatus.ENRICHED]: "active",
  [VisitorIdentificationStatus.IDENTIFIED]: "info",
  [VisitorIdentificationStatus.ANONYMOUS]: "neutral",
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) {
    const remainingMins = mins % 60;
    return remainingMins > 0 ? `${hrs}h ${remainingMins}m` : `${hrs}h`;
  }
  const days = Math.floor(hrs / 24);
  const remainingHrs = hrs % 24;
  return remainingHrs > 0 ? `${days}d ${remainingHrs}h` : `${days}d`;
}

function linkedinUrl(enrichedData: unknown): string | null {
  if (!enrichedData || typeof enrichedData !== "object" || Array.isArray(enrichedData)) {
    return null;
  }
  const record = enrichedData as Record<string, unknown>;
  const raw =
    record["LINKEDIN_URL"] ??
    record["linkedin_url"] ??
    record["LINKEDIN"] ??
    null;
  if (typeof raw === "string" && raw.trim().length > 0) return raw.trim();
  return null;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function VisitorAvatar({
  identity,
  visitorId,
  palette,
}: {
  identity: ReturnType<typeof extractIdentity>;
  visitorId: string;
  palette: string;
}) {
  if (identity.logoUrl) {
    return (
      <div className="h-10 w-10 rounded-full border overflow-hidden bg-white flex items-center justify-center shrink-0">
        <Image
          src={identity.logoUrl}
          alt={identity.companyName ?? "Company logo"}
          width={40}
          height={40}
          className="h-10 w-10 object-contain"
          unoptimized
        />
      </div>
    );
  }
  return (
    <div
      className={cn(
        "h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0",
        palette
      )}
    >
      {identity.initials}
    </div>
  );
}

function IdentityRow({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <dt className="w-20 shrink-0 text-muted-foreground flex items-center gap-1 text-xs pt-0.5">
        {icon}
        {label}
      </dt>
      <dd className="flex-1 min-w-0 font-medium text-foreground">{children}</dd>
    </div>
  );
}

function ConversationPreview({ messages }: { messages: unknown }) {
  if (!Array.isArray(messages) || messages.length === 0) return null;

  // Take last 4 messages
  const recent = messages.slice(-4) as Array<{
    role?: string;
    content?: string;
  }>;

  return (
    <div className="space-y-2">
      {recent.map((msg, idx) => {
        const isUser = msg.role === "user";
        return (
          <div
            key={idx}
            className={cn(
              "text-xs px-3 py-2 rounded-md max-w-[90%]",
              isUser
                ? "bg-primary/10 text-foreground ml-auto text-right"
                : "bg-muted text-foreground"
            )}
          >
            {msg.content ?? ""}
          </div>
        );
      })}
    </div>
  );
}
