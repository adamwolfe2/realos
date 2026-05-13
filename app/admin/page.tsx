import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Users,
  FileInput,
  Kanban,
  Activity,
  Brush,
  Megaphone,
  Building2,
  MessageSquare,
  Sparkles,
  UserPlus,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { requireAgency } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { OrgType, TenantStatus } from "@prisma/client";
import { PageHeader, SectionCard } from "@/components/admin/page-header";

export const metadata: Metadata = { title: "Agency overview" };
export const dynamic = "force-dynamic";

const DAY = 24 * 60 * 60 * 1000;

export default async function AdminHome() {
  await requireAgency();

  const now = new Date();
  const thirtyDaysAgo = new Date(Date.now() - 30 * DAY);
  const sevenDaysAgo = new Date(Date.now() - 7 * DAY);

  const [
    activeClients,
    atRiskClients,
    intakeNewToday,
    intakePending,
    pipelineCounts,
    leadsThisMonth,
    openCreative,
    recentSubmissions,
  ] = await Promise.all([
    prisma.organization.count({
      where: { orgType: OrgType.CLIENT, status: TenantStatus.ACTIVE },
    }),
    prisma.organization.count({
      where: { orgType: OrgType.CLIENT, status: TenantStatus.AT_RISK },
    }),
    prisma.intakeSubmission.count({
      where: { submittedAt: { gte: new Date(now.getTime() - DAY) } },
    }),
    prisma.intakeSubmission.count({
      where: { reviewedAt: null, convertedAt: null },
    }),
    prisma.organization.groupBy({
      by: ["status"],
      where: { orgType: OrgType.CLIENT },
      _count: { id: true },
    }),
    prisma.lead.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.creativeRequest.count({
      where: { status: { in: ["SUBMITTED", "IN_REVIEW", "IN_PROGRESS"] } },
    }),
    prisma.intakeSubmission.findMany({
      orderBy: { submittedAt: "desc" },
      take: 5,
    }),
  ]);

  const statusMap = new Map(
    pipelineCounts.map((r) => [r.status, r._count?.id ?? 0] as const),
  );
  const pipelineStaleCutoff = sevenDaysAgo;
  const staleIntakes = await prisma.intakeSubmission
    .count({
      where: {
        reviewedAt: null,
        convertedAt: null,
        submittedAt: { lte: pipelineStaleCutoff },
      },
    })
    .catch(() => 0);

  const totalPipeline =
    activeClients +
    (statusMap.get(TenantStatus.CONTRACT_SIGNED) ?? 0) +
    (statusMap.get(TenantStatus.BUILD_IN_PROGRESS) ?? 0) +
    (statusMap.get(TenantStatus.QA) ?? 0) +
    (statusMap.get(TenantStatus.AT_RISK) ?? 0);

  return (
    <div className="space-y-6 max-w-7xl">
      <PageHeader
        title="Welcome back"
        description={
          totalPipeline === 0
            ? "No tenants yet — capture your first intake to start the pipeline."
            : `${totalPipeline} tenant${totalPipeline === 1 ? "" : "s"} in the pipeline across all stages.`
        }
        actions={
          <Link
            href="/admin/pipeline"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Open pipeline
            <ArrowRight className="h-3 w-3" />
          </Link>
        }
      />

      {/* Action Inbox */}
      <SectionCard
        label="Action inbox"
        description={
          intakeNewToday + openCreative + atRiskClients + staleIntakes === 0
            ? "Nothing on the board — you're caught up."
            : "What needs your attention right now."
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <ActionCard
            href="/admin/intakes"
            icon={<Sparkles className="h-4 w-4" />}
            title="New today"
            count={intakeNewToday}
            hint="Overnight intake submissions"
          />
          <ActionCard
            href="/admin/intakes"
            icon={<UserPlus className="h-4 w-4" />}
            title="Pending review"
            count={intakePending}
            hint="Intakes awaiting decision"
          />
          <ActionCard
            href="/admin/creative-requests"
            icon={<Brush className="h-4 w-4" />}
            title="Open creative"
            count={openCreative}
            hint="Requests in Submitted / In review / In progress"
          />
          <ActionCard
            href="/admin/clients?status=AT_RISK"
            icon={<AlertTriangle className="h-4 w-4" />}
            title="At-risk clients"
            count={atRiskClients}
            hint="Flagged for churn review"
            tone={atRiskClients > 0 ? "warn" : undefined}
          />
        </div>
      </SectionCard>

      {/* Pipeline funnel */}
      <SectionCard
        label="Tenant funnel"
        description="Live state of every tenant by stage."
        action={
          <Link
            href="/admin/pipeline"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Open pipeline <ArrowRight className="h-3 w-3" />
          </Link>
        }
      >
        <div className="space-y-2">
          <FunnelRow
            icon={<Sparkles className="h-4 w-4" />}
            label="Intake"
            description="Pending intake submissions"
            count={intakePending}
            tone="neutral"
          />
          <FunnelRow
            icon={<Kanban className="h-4 w-4" />}
            label="Contract signed"
            description="Scoped, awaiting build"
            count={statusMap.get(TenantStatus.CONTRACT_SIGNED) ?? 0}
            tone="neutral"
          />
          <FunnelRow
            icon={<Clock className="h-4 w-4" />}
            label="Build in progress"
            description="Development underway"
            count={statusMap.get(TenantStatus.BUILD_IN_PROGRESS) ?? 0}
            tone="neutral"
          />
          <FunnelRow
            icon={<Activity className="h-4 w-4" />}
            label="QA"
            description="Client walkthrough + final review"
            count={statusMap.get(TenantStatus.QA) ?? 0}
            tone="neutral"
          />
          <FunnelRow
            icon={<Building2 className="h-4 w-4" />}
            label="Active"
            description="Live + generating MRR"
            count={activeClients}
            tone="success"
          />
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent intakes (2/3) */}
        <div className="lg:col-span-2">
          <SectionCard
            label="Recent intakes"
            action={
              <Link
                href="/admin/intakes"
                className="text-xs text-primary hover:underline"
              >
                View all →
              </Link>
            }
          >
            {recentSubmissions.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                <p>No intake submissions yet.</p>
                <p className="text-xs mt-1">
                  Share your intake form to start filling the pipeline.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {recentSubmissions.map((s) => {
                  const isHot = !s.reviewedAt && !s.convertedAt;
                  const initial = (s.companyName ?? "?")
                    .slice(0, 1)
                    .toUpperCase();
                  return (
                    <li key={s.id}>
                      <Link
                        href={`/admin/intakes/${s.id}`}
                        className="flex items-center gap-3 py-3 -mx-2 px-2 rounded-lg hover:bg-muted/40 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground flex-shrink-0">
                          {initial}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-foreground font-medium truncate">
                            {s.companyName}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {s.propertyType}
                            {s.currentBackendPlatform
                              ? ` · ${s.currentBackendPlatform}`
                              : ""}
                          </p>
                        </div>
                        {isHot && (
                          <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border flex-shrink-0 text-primary bg-primary/10 border-primary/30">
                            New
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground font-mono flex-shrink-0 w-16 text-right">
                          {timeAgo(s.submittedAt)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>
        </div>

        {/* Jump to (1/3) */}
        <SectionCard label="Jump to">
          <div className="space-y-2">
            <QuickLink
              href="/admin/pipeline"
              icon={<Kanban className="h-4 w-4" />}
              label="Pipeline board"
            />
            <QuickLink
              href="/admin/intakes"
              icon={<FileInput className="h-4 w-4" />}
              label="Intake queue"
            />
            <QuickLink
              href="/admin/leads"
              icon={<Activity className="h-4 w-4" />}
              label={`Leads (${leadsThisMonth} new, 30d)`}
            />
            <QuickLink
              href="/admin/clients"
              icon={<Users className="h-4 w-4" />}
              label="All clients"
            />
            <QuickLink
              href="/admin/creative-requests"
              icon={<Brush className="h-4 w-4" />}
              label="Creative queue"
            />
            <QuickLink
              href="/admin/campaigns"
              icon={<Megaphone className="h-4 w-4" />}
              label="Ad campaigns"
            />
            <QuickLink
              href="/admin/chat"
              icon={<MessageSquare className="h-4 w-4" />}
              label="Support chat"
            />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function ActionCard({
  href,
  icon,
  title,
  count,
  hint,
  tone,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  count: number;
  hint: string;
  tone?: "warn";
}) {
  const isEmpty = count === 0;
  return (
    <Link
      href={href}
      className={
        "group relative rounded-xl border p-4 transition-all duration-150 " +
        (isEmpty
          ? "border-border bg-muted/20 hover:bg-muted/40"
          : tone === "warn"
            ? "border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50"
            : "border-border bg-card hover:border-primary/40 hover:bg-accent/40")
      }
    >
      <div className="flex items-start justify-between mb-2">
        <div
          className={
            "flex h-8 w-8 items-center justify-center rounded-md " +
            (isEmpty
              ? "bg-muted text-muted-foreground"
              : "bg-primary/10 text-primary")
          }
        >
          {icon}
        </div>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
      </div>
      <div
        className={
          "text-3xl font-semibold tracking-tight tabular-nums " +
          (isEmpty ? "text-muted-foreground/60" : "text-foreground")
        }
      >
        {count}
      </div>
      <p className="text-sm font-medium text-foreground mt-1">{title}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>
    </Link>
  );
}

function FunnelRow({
  icon,
  label,
  description,
  count,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  count: number;
  tone: "neutral" | "success";
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2.5">
      <span
        className={
          "flex h-7 w-7 items-center justify-center rounded-md shrink-0 " +
          (tone === "success"
            ? "bg-primary/5 text-primary"
            : "bg-primary/10 text-primary")
        }
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground truncate">{description}</p>
      </div>
      <span
        className={
          "text-lg font-semibold tabular-nums shrink-0 " +
          (tone === "success" && count > 0
            ? "text-primary"
            : count > 0
              ? "text-foreground"
              : "text-muted-foreground/50")
        }
      >
        {count}
      </span>
    </div>
  );
}

function QuickLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 p-2.5 rounded-lg border border-border hover:border-primary/40 hover:bg-accent/60 text-sm font-medium text-foreground transition-colors group"
    >
      <span className="text-muted-foreground group-hover:text-primary transition-colors">
        {icon}
      </span>
      <span className="flex-1">{label}</span>
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
    </Link>
  );
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  return `${months}mo`;
}
