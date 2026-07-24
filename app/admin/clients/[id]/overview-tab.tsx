import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { AlertOctagon, AlertTriangle } from "lucide-react";
import { StatCard } from "@/components/admin/stat-card";
import { StatusBadge } from "@/components/admin/status-badge";
import { SectionCard } from "@/components/admin/page-header";
import { LaunchReadiness } from "./launch-readiness";
import { humanLeadSource, humanLeadStatus, leadStatusTone } from "@/lib/format";
import type { AdminActionItem } from "@/lib/admin/insights";
import type { DataSinkSummary } from "@/lib/admin/data-sinks";

// Mirrors the (unexported) ReadinessItem shape in ./launch-readiness.tsx —
// kept in sync manually since that component isn't touched for behavior.
type ReadinessItem = {
  label: string;
  status: "ok" | "missing" | "warn";
  hint?: string;
  href?: string;
};

type RecentLead = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  source: string;
  status: string;
};

type AppFolioSummary = {
  instanceSubdomain: string;
  syncStatus: string | null;
  lastSyncAt: Date | null;
  lastError: string | null;
} | null;

type ActiveProject = {
  id: string;
  name: string;
  _count: { tasks: number };
};

// ---------------------------------------------------------------------------
// OverviewTab — the default tab. KPI strip + launch readiness + a compact
// "fires" summary (critical issues + any sync currently erroring/dead,
// deep-linking to Integrations for the full picture) + recent leads +
// AppFolio status line. The "Active project" card only renders when a
// project actually exists — an empty card was pure noise.
// ---------------------------------------------------------------------------

export function OverviewTab({
  orgId,
  counts,
  readinessItems,
  actionItems,
  failingSinks,
  recentLeads,
  appfolio,
  activeProjects,
}: {
  orgId: string;
  counts: {
    properties: number;
    leads: number;
    visitors: number;
    chatbotConversations: number;
    adCampaigns: number;
    domains: number;
  };
  readinessItems: ReadinessItem[];
  actionItems: AdminActionItem[];
  failingSinks: DataSinkSummary[];
  recentLeads: RecentLead[];
  appfolio: AppFolioSummary;
  activeProjects: ActiveProject[];
}) {
  const criticalItems = actionItems.filter((i) => i.severity === "critical");
  const fireCount = criticalItems.length + failingSinks.length;

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Properties" value={counts.properties} />
        <StatCard label="Leads" value={counts.leads} />
        <StatCard label="Visitors" value={counts.visitors} />
        <StatCard label="Chats" value={counts.chatbotConversations} />
        <StatCard label="Ad campaigns" value={counts.adCampaigns} />
        <StatCard label="Domains" value={counts.domains} />
      </section>

      <LaunchReadiness items={readinessItems} />

      {fireCount > 0 ? (
        <SectionCard
          label="Fires"
          description={`${fireCount} issue${fireCount === 1 ? "" : "s"} need attention right now.`}
          action={
            <Link
              href={`/admin/clients/${orgId}?tab=integrations`}
              className="text-[11px] font-medium text-primary hover:underline underline-offset-2 whitespace-nowrap"
            >
              Open Integrations →
            </Link>
          }
        >
          <ul className="space-y-1.5">
            {criticalItems.map((item) => (
              <li key={item.id} className="ls-alert ls-alert-critical flex items-start gap-2.5">
                <AlertOctagon
                  className="h-4 w-4 mt-0.5 shrink-0 text-destructive"
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-snug text-foreground">
                    {item.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                    {item.detail}
                  </p>
                </div>
              </li>
            ))}
            {failingSinks.map((sink) => (
              <li
                key={sink.provider}
                className="ls-alert ls-alert-warning flex items-start gap-2.5"
              >
                <AlertTriangle
                  className="h-4 w-4 mt-0.5 shrink-0"
                  style={{ color: "#8a6d00" }}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-snug text-foreground">
                    {sink.label} sync is failing
                  </p>
                  {sink.lastErrorMessage ? (
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug line-clamp-1">
                      {sink.lastErrorMessage}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      {activeProjects.length > 0 ? (
        <SectionCard label="Active project">
          <ul className="space-y-2">
            {activeProjects.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 py-1 text-sm"
              >
                <span className="text-foreground truncate">{p.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {p._count.tasks} task{p._count.tasks === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard label="Recent leads">
          {recentLeads.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No leads captured yet.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {recentLeads.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-foreground truncate">
                      {l.firstName
                        ? `${l.firstName}${l.lastName ? " " + l.lastName : ""}`
                        : (l.email ?? "Anonymous")}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {humanLeadSource(l.source)}
                    </div>
                  </div>
                  <StatusBadge tone={leadStatusTone(l.status)}>
                    {humanLeadStatus(l.status)}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard label="AppFolio sync">
          {appfolio ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-xs text-muted-foreground">Subdomain</span>
                <span className="font-mono text-[12px] text-foreground">
                  {appfolio.instanceSubdomain}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-xs text-muted-foreground">Status</span>
                <StatusBadge
                  tone={
                    appfolio.lastError
                      ? "danger"
                      : appfolio.lastSyncAt
                        ? "success"
                        : "neutral"
                  }
                >
                  {appfolio.lastError
                    ? "Error"
                    : appfolio.lastSyncAt
                      ? "Synced"
                      : "Idle"}
                </StatusBadge>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-xs text-muted-foreground">Last sync</span>
                <span className="text-foreground">
                  {appfolio.lastSyncAt
                    ? formatDistanceToNow(appfolio.lastSyncAt, {
                        addSuffix: true,
                      })
                    : "Never"}
                </span>
              </div>
              {appfolio.lastError ? (
                <p className="text-[11px] text-destructive rounded-md border border-destructive/30 bg-destructive/5 p-2 break-words">
                  {appfolio.lastError}
                </p>
              ) : null}
              <Link
                href={`/admin/clients/${orgId}?tab=integrations`}
                className="text-[11px] font-medium text-primary hover:underline underline-offset-2 inline-block pt-1"
              >
                Full sync detail →
              </Link>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              AppFolio not connected.
            </p>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
