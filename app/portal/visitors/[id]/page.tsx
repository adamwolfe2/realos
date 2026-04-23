import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { formatDistanceToNow, format } from "date-fns";
import { prisma } from "@/lib/db";
import { requireScope } from "@/lib/tenancy/scope";
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
} from "lucide-react";
import {
  avatarPaletteFor,
  extractIdentity,
} from "@/lib/visitors/enrichment";
import { cn } from "@/lib/utils";
import { PageHeader, SectionCard } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { EngageComposer } from "../engage-composer";

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

  const visitor = await prisma.visitor.findUnique({
    where: { id },
    include: {
      sessions: {
        orderBy: { startedAt: "desc" },
        include: {
          events: {
            orderBy: { occurredAt: "asc" },
          },
        },
      },
    },
  });

  if (!visitor || visitor.orgId !== scope.orgId) notFound();

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

  // Engagement metrics
  const totalSessions = visitor.sessions.length;
  const totalPageviews = visitor.sessions.reduce(
    (acc, s) => acc + s.pageviewCount,
    0
  );
  const totalTimeSeconds = visitor.sessions.reduce(
    (acc, s) => acc + s.totalTimeSeconds,
    0
  );
  const maxScrollDepth = visitor.sessions.reduce(
    (acc, s) => Math.max(acc, s.maxScrollDepth),
    0
  );

  const isLive =
    visitor.sessions.some(
      (s) => s.lastEventAt.getTime() >= Date.now() - LIVE_WINDOW_MS
    );

  const statusConfig = statusBadgeConfig(visitor.status);

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
            {isLive ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live now
              </span>
            ) : null}
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
            {/* Status pill */}
            <span
              className={cn(
                "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md border",
                statusConfig.classes
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", statusConfig.dot)} />
              {statusConfig.label}
            </span>
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
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="text-sm font-medium text-emerald-800 mb-3">
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

            {/* Lead link */}
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
            ) : null}
          </SectionCard>
        </div>

        {/* Right: Engagement + Sessions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Engagement metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              label="Sessions"
              value={totalSessions}
              hint="Unique visits"
            />
            <StatCard
              label="Pageviews"
              value={totalPageviews}
              hint="Across all sessions"
            />
            <StatCard
              label="Time on site"
              value={formatDuration(totalTimeSeconds)}
              hint="Total engaged time"
            />
            <StatCard
              label="Max scroll"
              value={`${maxScrollDepth}%`}
              hint="Deepest scroll depth"
              tone={maxScrollDepth >= 75 ? "success" : undefined}
            />
          </div>

          {/* Intent score */}
          <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-5 py-4">
            <div
              className={cn(
                "text-4xl font-semibold tabular-nums",
                visitor.intentScore >= 80
                  ? "text-red-600"
                  : visitor.intentScore >= 60
                  ? "text-orange-500"
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
                    <li key={session.id} className="p-5 space-y-2.5">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <span className="text-xs text-muted-foreground font-normal">
                            Session {totalSessions - idx}
                          </span>
                          {session.lastEventAt.getTime() >=
                          Date.now() - LIVE_WINDOW_MS ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
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

function statusBadgeConfig(status: VisitorIdentificationStatus) {
  switch (status) {
    case VisitorIdentificationStatus.MATCHED_TO_LEAD:
      return {
        label: "Matched to lead",
        dot: "bg-emerald-500",
        classes: "text-emerald-700 bg-emerald-50 border-emerald-200",
      };
    case VisitorIdentificationStatus.ENRICHED:
      return {
        label: "Enriched",
        dot: "bg-blue-500",
        classes: "text-blue-700 bg-blue-50 border-blue-200",
      };
    case VisitorIdentificationStatus.IDENTIFIED:
      return {
        label: "Identified",
        dot: "bg-blue-400",
        classes: "text-blue-700 bg-blue-50 border-blue-200",
      };
    case VisitorIdentificationStatus.ANONYMOUS:
    default:
      return {
        label: "Anonymous",
        dot: "bg-neutral-400",
        classes: "text-muted-foreground bg-muted border-border",
      };
  }
}

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
