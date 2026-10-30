import type { ReactNode } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { AlertOctagon, AlertTriangle, CircleDashed } from "lucide-react";
import { StatCard } from "@/components/admin/stat-card";
import { StatusBadge } from "@/components/admin/status-badge";
import { SectionCard } from "@/components/admin/page-header";
import {
  StatusChip,
  type ConnectionStatus,
} from "@/components/portal/ui/status-chip";
import { humanLeadSource, humanLeadStatus, leadStatusTone } from "@/lib/format";
import type { AdminActionItem } from "@/lib/admin/insights";
import type { DataSinkSummary, SinkStatus } from "@/lib/admin/data-sinks";

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
  createdAt: Date;
  property: { name: string } | null;
};

type ActiveProject = {
  id: string;
  name: string;
  _count: { tasks: number };
};

export type OverviewStats = {
  leads30d: number;
  leadsPrev30d: number;
  chats30d: number;
  chatsPrev30d: number;
  liveProperties: number;
  syncedProperties: number;
  lastLogin: { at: Date; who: string } | null;
};

// ---------------------------------------------------------------------------
// OverviewTab — one screen, one story: is this client's data flowing and
// is anything producing? 30-day KPI strip, an attention band that only
// renders when something is actually wrong, then recent leads beside the
// per-source "data pipes" list (every source, last good sync, or not
// connected). Launch checklist collapses to one line once it's done.
// ---------------------------------------------------------------------------

export function OverviewTab({
  orgId,
  stats,
  readinessItems,
  actionItems,
  dataSinks,
  recentLeads,
  activeProjects,
}: {
  orgId: string;
  stats: OverviewStats;
  readinessItems: ReadinessItem[];
  actionItems: AdminActionItem[];
  /** null when pipe health failed to load. */
  dataSinks: DataSinkSummary[] | null;
  recentLeads: RecentLead[];
  activeProjects: ActiveProject[];
}) {
  const criticalItems = actionItems.filter((i) => i.severity === "critical");
  const failingSinks = (dataSinks ?? []).filter(
    (s) => s.status === "erroring" || s.status === "dead",
  );
  const missingSetup = readinessItems.filter((i) => i.status === "missing");
  const hasAttention =
    criticalItems.length + failingSinks.length + missingSetup.length > 0;

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Leads, 30 days"
          value={stats.leads30d.toLocaleString()}
          hint={versus(stats.leads30d, stats.leadsPrev30d)}
        />
        <StatCard
          label="Chats, 30 days"
          value={stats.chats30d.toLocaleString()}
          hint={versus(stats.chats30d, stats.chatsPrev30d)}
        />
        <StatCard
          label="Live properties"
          value={stats.liveProperties.toLocaleString()}
          hint={`of ${stats.syncedProperties.toLocaleString()} in the account`}
        />
        <StatCard
          label="Last client login"
          value={
            stats.lastLogin
              ? formatDistanceToNow(stats.lastLogin.at, { addSuffix: true })
              : "Never"
          }
          hint={stats.lastLogin?.who ?? "No one has signed in yet"}
        />
      </section>

      {hasAttention ? (
        <SectionCard label="Needs attention">
          <ul className="divide-y divide-border -my-2">
            {criticalItems.map((item) => (
              <AttentionRow
                key={item.id}
                icon={<AlertOctagon className="h-4 w-4 text-destructive" />}
                title={item.title}
                detail={item.detail}
              />
            ))}
            {failingSinks.map((sink) => (
              <AttentionRow
                key={sink.provider}
                icon={<AlertTriangle className="h-4 w-4 text-destructive" />}
                title={`${sink.label} is not syncing`}
                detail={
                  sink.lastSuccessAt
                    ? `Last good sync ${formatDistanceToNow(sink.lastSuccessAt, { addSuffix: true })}.${sink.lastErrorMessage ? ` ${sink.lastErrorMessage}` : ""}`
                    : (sink.lastErrorMessage ?? "No successful sync on record.")
                }
                href={`/admin/clients/${orgId}?tab=integrations`}
              />
            ))}
            {missingSetup.map((item) => (
              <AttentionRow
                key={item.label}
                icon={<CircleDashed className="h-4 w-4 text-muted-foreground" />}
                title={`Setup: ${item.label}`}
                detail={item.hint}
                href={`/admin/clients/${orgId}/activation`}
              />
            ))}
          </ul>
        </SectionCard>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        <SectionCard
          label="Recent leads"
          className="lg:col-span-2"
        >
          <RecentLeadsTable leads={recentLeads} />
        </SectionCard>

        <div className="space-y-5">
          <SectionCard
            label="Data pipes"
            action={
              <Link
                href={`/admin/clients/${orgId}?tab=integrations`}
                className="text-xs font-medium text-primary hover:underline underline-offset-2"
              >
                Details
              </Link>
            }
          >
            {dataSinks ? (
              <DataPipes sinks={dataSinks} />
            ) : (
              <p className="text-sm text-destructive">
                Could not load sync health. Reload, or open Details.
              </p>
            )}
            <SetupLine items={readinessItems} orgId={orgId} />
          </SectionCard>

          {activeProjects.length > 0 ? (
            <SectionCard label="Active project">
              <ul className="space-y-1.5">
                {activeProjects.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="text-foreground truncate">{p.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                      {p._count.tasks} task{p._count.tasks === 1 ? "" : "s"}
                    </span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function versus(current: number, previous: number): string {
  if (previous === 0) return current === 0 ? "None in the prior 30 days either" : "None in the prior 30 days";
  const pct = Math.round(((current - previous) / previous) * 100);
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct}% vs prior 30 days (${previous.toLocaleString()})`;
}

function AttentionRow({
  icon,
  title,
  detail,
  href,
}: {
  icon: ReactNode;
  title: string;
  detail?: string;
  href?: string;
}) {
  const body = (
    <>
      <span className="mt-0.5 shrink-0" aria-hidden="true">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">
          {title}
        </span>
        {detail ? (
          <span
            className="block text-xs text-muted-foreground mt-0.5 line-clamp-2 break-words"
            title={detail}
          >
            {detail}
          </span>
        ) : null}
      </span>
    </>
  );
  return (
    <li>
      {href ? (
        <Link
          href={href}
          className="flex items-start gap-3 py-2.5 hover:bg-muted/40 -mx-2 px-2 transition-colors"
        >
          {body}
        </Link>
      ) : (
        <div className="flex items-start gap-3 py-2.5">{body}</div>
      )}
    </li>
  );
}

function RecentLeadsTable({ leads }: { leads: RecentLead[] }) {
  if (leads.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No leads captured yet.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto -mx-5 -mb-5">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-y border-border text-left text-xs text-muted-foreground">
            <th className="font-medium py-2 pl-5 pr-3">Name</th>
            <th className="font-medium py-2 px-3 hidden md:table-cell">Property</th>
            <th className="font-medium py-2 px-3">Source</th>
            <th className="font-medium py-2 px-3">Status</th>
            <th className="font-medium py-2 pl-3 pr-5 text-right">Received</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {leads.map((l) => (
            <tr key={l.id}>
              <td className="py-2.5 pl-5 pr-3 max-w-[14rem]">
                <span className="block truncate font-medium text-foreground">
                  {l.firstName
                    ? `${l.firstName}${l.lastName ? " " + l.lastName : ""}`
                    : (l.email ?? "Anonymous")}
                </span>
              </td>
              <td className="py-2.5 px-3 hidden md:table-cell max-w-[12rem]">
                <span className="block truncate text-muted-foreground">
                  {l.property?.name ?? "Unassigned"}
                </span>
              </td>
              <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                {humanLeadSource(l.source)}
              </td>
              <td className="py-2.5 px-3">
                <StatusBadge tone={leadStatusTone(l.status)}>
                  {humanLeadStatus(l.status)}
                </StatusBadge>
              </td>
              <td className="py-2.5 pl-3 pr-5 text-right text-muted-foreground whitespace-nowrap tabular-nums">
                {formatDistanceToNow(l.createdAt, { addSuffix: true })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const PIPE_CHIP: Record<SinkStatus, { status: ConnectionStatus; label: string }> = {
  fresh: { status: "live", label: "Live" },
  stale: { status: "stale", label: "Stale" },
  erroring: { status: "error", label: "Failing" },
  dead: { status: "error", label: "Failing" },
  missing: { status: "not_connected", label: "Not connected" },
};

const PIPE_ORDER: Record<SinkStatus, number> = {
  dead: 0,
  erroring: 1,
  stale: 2,
  fresh: 3,
  missing: 4,
};

// Reputation, AEO and DataForSEO only have platform-wide run history, so
// they can't say whether THIS client's data is flowing. Left to the
// Integrations tab rather than shown as a per-client "Live".
const PLATFORM_ONLY = new Set(["reputation", "aeo", "dataforseo"]);

function DataPipes({ sinks }: { sinks: DataSinkSummary[] }) {
  const sorted = sinks.filter((s) => !PLATFORM_ONLY.has(s.provider)).sort(
    (a, b) => PIPE_ORDER[a.status] - PIPE_ORDER[b.status],
  );
  return (
    <ul className="space-y-2.5">
      {sorted.map((s) => {
        const chip = PIPE_CHIP[s.status];
        return (
          <li key={s.provider} className="flex items-center justify-between gap-3">
            <span className="min-w-0">
              <span
                className={
                  s.status === "missing"
                    ? "block text-sm text-muted-foreground truncate"
                    : "block text-sm text-foreground truncate"
                }
              >
                {s.label}
              </span>
              {s.lastSuccessAt ? (
                <span className="block text-xs text-muted-foreground tabular-nums">
                  Synced {formatDistanceToNow(s.lastSuccessAt, { addSuffix: true })}
                </span>
              ) : null}
            </span>
            <StatusChip status={chip.status} label={chip.label} />
          </li>
        );
      })}
    </ul>
  );
}

function SetupLine({ items, orgId }: { items: ReadinessItem[]; orgId: string }) {
  const done = items.filter((i) => i.status === "ok").length;
  const open = items.filter((i) => i.status !== "ok").map((i) => i.label);
  return (
    <Link
      href={`/admin/clients/${orgId}/activation`}
      className="mt-4 pt-3 border-t border-border flex items-baseline justify-between gap-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
    >
      <span className="truncate">
        {open.length === 0 ? "Launch setup complete" : `Open: ${open.join(", ")}`}
      </span>
      <span className="shrink-0 tabular-nums">
        {done} of {items.length} done
      </span>
    </Link>
  );
}
