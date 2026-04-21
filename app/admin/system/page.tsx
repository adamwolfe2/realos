import type { Metadata } from "next";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { requireAgency } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/admin/page-header";
import {
  runSystemHealthDeep,
  type CheckResult,
  type CronRunSummary,
  type HealthStatus,
} from "@/lib/health/checks";
import {
  Database,
  Shield,
  Brain,
  Radio,
  CreditCard,
  Mail,
  KeyRound,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";

export const metadata: Metadata = { title: "System health" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

// ---------------------------------------------------------------------------
// Cron schedule mirrors vercel.json. Kept inline so the page renders even if
// vercel.json is unreachable from the runtime (it is at build time only).
// ---------------------------------------------------------------------------
const CRON_SCHEDULE: Array<{ jobName: string; schedule: string; description: string }> = [
  { jobName: "billing-reminders", schedule: "0 9 * * *", description: "Daily — past-due tenant reminders (stub)" },
  { jobName: "lapsed-leads", schedule: "0 11 * * *", description: "Daily — close leads inactive for 14 days" },
  { jobName: "intake-nurture", schedule: "0 12 * * *", description: "Daily — intake follow-up (stub)" },
  { jobName: "onboarding-drip", schedule: "0 13 * * *", description: "Daily — new-tenant onboarding emails (stub)" },
  { jobName: "lead-nurture", schedule: "0 14 * * *", description: "Daily — lead lifecycle emails" },
  { jobName: "lead-score-refresh", schedule: "*/30 * * * *", description: "Every 30 min — recompute lead scores" },
  { jobName: "visitor-outreach", schedule: "*/15 * * * *", description: "Every 15 min — high-intent visitor outreach" },
  { jobName: "weekly-report", schedule: "0 7 * * 1", description: "Mondays — agency weekly report (stub)" },
  { jobName: "weekly-digest", schedule: "0 8 * * 1", description: "Mondays — tenant weekly digest (stub)" },
  { jobName: "pixel-weekly-digest", schedule: "0 9 * * 1", description: "Mondays — visitor pixel digest" },
  { jobName: "webhook-retry", schedule: "*/5 * * * *", description: "Every 5 min — outbound webhook retry (stub)" },
  { jobName: "appfolio-sync", schedule: "0 * * * *", description: "Hourly — AppFolio property/listing sync" },
  { jobName: "seo-sync", schedule: "0 6 * * *", description: "Daily — GSC + GA4 snapshot" },
  { jobName: "ads-sync", schedule: "0 7 * * *", description: "Daily — Google + Meta ad metrics" },
];

// ---------------------------------------------------------------------------
// Tone helpers — semantic colors mirror /admin/audit-log + /admin/tenants.
// ---------------------------------------------------------------------------
function toneFor(status: HealthStatus): string {
  if (status === "ok") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (status === "degraded") return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-rose-100 text-rose-700 border-rose-200";
}

function bannerToneFor(status: HealthStatus): string {
  if (status === "ok") return "bg-emerald-50 border-emerald-200 text-emerald-900";
  if (status === "degraded") return "bg-amber-50 border-amber-200 text-amber-900";
  return "bg-rose-50 border-rose-200 text-rose-900";
}

function statusLabel(status: HealthStatus): string {
  if (status === "ok") return "Operational";
  if (status === "degraded") return "Degraded";
  return "Down";
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default async function SystemHealthPage() {
  await requireAgency();

  const [health, recentAudits] = await Promise.all([
    runSystemHealthDeep(),
    prisma.auditEvent
      .findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          org: { select: { name: true, slug: true } },
          user: { select: { email: true } },
        },
      })
      .catch(() => []),
  ]);

  const checkCards = [
    { key: "database", label: "Database (Neon)", icon: Database, check: health.checks.database },
    { key: "env", label: "Environment", icon: KeyRound, check: health.checks.env },
    { key: "clerk", label: "Clerk", icon: Shield, check: health.checks.clerk },
    { key: "anthropic", label: "Anthropic", icon: Brain, check: health.checks.anthropic },
    { key: "cursive", label: "Cursive / AudienceLab", icon: Radio, check: health.checks.cursive },
    { key: "stripe", label: "Stripe", icon: CreditCard, check: health.checks.stripe },
    { key: "resend", label: "Resend", icon: Mail, check: health.checks.resend },
  ] as const;

  const sentryDashboardUrl = process.env.SENTRY_DASHBOARD_URL ?? "https://sentry.io";

  return (
    <div className="space-y-6">
      <PageHeader
        title="System health"
        description="Live status of every dependency, scheduled job, and recent platform activity. Pulled fresh on every page load."
        actions={
          <Link
            href="/api/health/deep"
            className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/30"
          >
            View JSON
          </Link>
        }
      />

      {/* Overall status banner */}
      <div className={`rounded-lg border p-5 ${bannerToneFor(health.status)}`}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            {health.status === "ok" ? (
              <CheckCircle2 className="h-7 w-7" />
            ) : health.status === "degraded" ? (
              <AlertTriangle className="h-7 w-7" />
            ) : (
              <XCircle className="h-7 w-7" />
            )}
            <div>
              <div className="text-base font-semibold">
                Platform is {statusLabel(health.status).toLowerCase()}
              </div>
              <div className="text-xs opacity-80 mt-0.5">
                {health.checks.database.status === "ok"
                  ? "Database reachable"
                  : "Database error"}
                {" · "}
                aggregated in {health.totalLatencyMs}ms · build {health.version}
              </div>
            </div>
          </div>
          <div className="text-xs opacity-70 tabular-nums">
            Checked {formatDistanceToNow(new Date(health.timestamp), { addSuffix: true })}
          </div>
        </div>
      </div>

      {/* Check cards */}
      <section>
        <h2 className="text-sm font-semibold text-foreground mb-3">Dependency checks</h2>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {checkCards.map(({ key, label, icon: Icon, check }) => (
            <CheckCard key={key} label={label} icon={Icon} check={check} />
          ))}
        </div>
      </section>

      {/* Platform pulse */}
      <section>
        <h2 className="text-sm font-semibold text-foreground mb-3">Platform pulse (last 24h)</h2>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          <PulseStat label="Active tenants" value={health.pulse.activeTenants} />
          <PulseStat label="New leads" value={health.pulse.leadsLast24h} />
          <PulseStat label="New visitors" value={health.pulse.visitorsLast24h} />
          <PulseStat label="Chatbot conversations" value={health.pulse.chatbotConversationsLast24h} />
          <PulseStat label="Webhook events" value={health.pulse.webhookEventsLast24h} />
        </div>
      </section>

      {/* Cron schedule + last run */}
      <section>
        <h2 className="text-sm font-semibold text-foreground mb-3">Scheduled jobs</h2>
        <CronTable schedule={CRON_SCHEDULE} runs={health.recentCrons} />
      </section>

      {/* Recent audit events */}
      <section>
        <h2 className="text-sm font-semibold text-foreground mb-3">Recent activity</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-lg border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
              Last 20 audit events
            </div>
            {recentAudits.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No audit events yet.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {recentAudits.map((event) => (
                  <li key={event.id} className="px-4 py-3 flex items-center gap-3 text-sm">
                    <span className="text-[10px] uppercase tracking-wide bg-foreground/10 px-1.5 py-0.5 rounded font-medium">
                      {event.action.toLowerCase().replace(/_/g, " ")}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {event.entityType}
                    </span>
                    <span className="flex-1 truncate text-xs text-muted-foreground">
                      {event.description ?? "—"}
                    </span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {event.org?.slug ?? "system"}
                    </span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(event.createdAt, { addSuffix: true })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-lg border border-border bg-card p-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
              Errors + observability
            </div>
            <p className="text-sm text-muted-foreground">
              Application errors and unhandled exceptions are routed to Sentry.
              Open the dashboard to see issue trends, release health, and stack
              traces.
            </p>
            <div className="mt-4 space-y-2">
              <a
                href={sentryDashboardUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/30 text-center"
              >
                Open Sentry dashboard
              </a>
              <Link
                href="/admin/audit-log"
                className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/30 text-center"
              >
                Full audit log
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

function CheckCard({
  label,
  icon: Icon,
  check,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  check: CheckResult;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="text-sm font-medium text-foreground truncate">
            {label}
          </div>
        </div>
        <span
          className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${toneFor(check.status)}`}
        >
          {statusLabel(check.status)}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {check.latencyMs}ms
        </span>
        {check.details?.httpStatus ? (
          <span className="font-mono">HTTP {String(check.details.httpStatus)}</span>
        ) : null}
      </div>
      {check.message ? (
        <div className="mt-2 text-xs text-muted-foreground line-clamp-2 break-words">
          {check.message}
        </div>
      ) : null}
    </div>
  );
}

function PulseStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-2xl font-semibold mt-1 tabular-nums">{value}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cron table
// ---------------------------------------------------------------------------

function CronTable({
  schedule,
  runs,
}: {
  schedule: Array<{ jobName: string; schedule: string; description: string }>;
  runs: CronRunSummary[];
}) {
  const runsByName = new Map<string, CronRunSummary>();
  for (const r of runs) runsByName.set(r.jobName, r);

  const cutoff = Date.now() - 24 * 60 * 60 * 1000;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left font-medium">Job</th>
            <th className="px-4 py-3 text-left font-medium">Schedule</th>
            <th className="px-4 py-3 text-left font-medium">Last run</th>
            <th className="px-4 py-3 text-left font-medium">Status</th>
            <th className="px-4 py-3 text-right font-medium">Duration</th>
            <th className="px-4 py-3 text-right font-medium">Records</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {schedule.map((row) => {
            const run = runsByName.get(row.jobName);
            const ranRecently = run?.startedAt
              ? new Date(run.startedAt).getTime() > cutoff
              : false;
            const status: HealthStatus = !run
              ? "down"
              : run.status === "ok" && ranRecently
                ? "ok"
                : run.status === "ok"
                  ? "degraded"
                  : "down";
            return (
              <tr key={row.jobName} className="hover:bg-muted/20">
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{row.jobName}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {row.description}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs">
                  <code className="font-mono">{row.schedule}</code>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {run?.startedAt
                    ? formatDistanceToNow(new Date(run.startedAt), { addSuffix: true })
                    : "Never recorded"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${toneFor(status)}`}
                  >
                    {!run ? "No data" : run.status}
                  </span>
                  {run?.error ? (
                    <div className="text-[11px] text-rose-700 mt-1 truncate max-w-[180px]" title={run.error}>
                      {run.error}
                    </div>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-right text-xs tabular-nums">
                  {run?.durationMs != null ? `${run.durationMs}ms` : "—"}
                </td>
                <td className="px-4 py-3 text-right text-xs tabular-nums">
                  {run?.recordsProcessed ?? "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="px-4 py-2 text-[11px] text-muted-foreground bg-muted/20 border-t border-border">
        A job marked &quot;degraded&quot; ran successfully but more than 24 hours
        ago. &quot;No data&quot; means the CronRun table has never seen this job.
      </div>
    </div>
  );
}
