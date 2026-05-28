import * as React from "react";
import { StatCard } from "@/components/admin/stat-card";
import { SectionCard } from "@/components/admin/page-header";
import { AlertOctagon, AlertTriangle, Info } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { LaunchReadiness } from "../launch-readiness";
import { ModuleToggle } from "../module-toggle";
import { RentCastUsageRow } from "../rentcast-usage-row";
import { DomainsPanel } from "../domains-panel";
import { CursivePanel } from "../cursive-panel";
import type { ToggleableModule } from "@/lib/actions/admin-modules";

// Plain data shapes — keep this file pure-presentational so the page can
// stay the data-fetching seam.
type ActionItem = {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  occurredAt?: Date | string | null;
};

type LaunchReadinessItem = React.ComponentProps<typeof LaunchReadiness>["items"][number];

type Domain = {
  id: string;
  hostname: string;
  isPrimary: boolean;
  sslStatus: string | null;
  dnsConfigured: boolean;
};

type CursiveInitial = {
  cursivePixelId: string | null;
  cursiveSegmentId: string | null;
  installedOnDomain: string | null;
  lastEventAt: string | null;
  lastSegmentSyncAt: string | null;
  totalEventsCount: number;
};

type RentCastUsage = {
  used: number;
  budget: number;
  monthKey: string;
};

export function OverviewClientTab({
  orgId,
  orgName,
  counts,
  actionItems,
  readinessItems,
  moduleRows,
  rentCastUsage,
  domains,
  fallbackSlug,
  cursive,
  sharedWebhookUrl,
  tenantWebhookUrl,
}: {
  orgId: string;
  orgName: string;
  counts: {
    properties: number;
    leads: number;
    visitors: number;
    chatbotConversations: number;
    adCampaigns: number;
    domains: number;
  };
  actionItems: ActionItem[];
  readinessItems: LaunchReadinessItem[];
  moduleRows: Array<[ToggleableModule, string, boolean]>;
  rentCastUsage: RentCastUsage | null;
  domains: Domain[];
  fallbackSlug: string;
  cursive: CursiveInitial;
  sharedWebhookUrl: string;
  tenantWebhookUrl: string | null;
}) {
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

      {actionItems.length > 0 ? (
        <SectionCard
          label="Needs attention"
          description={`${actionItems.length} issue${actionItems.length === 1 ? "" : "s"} to resolve on this client.`}
        >
          <ul className="space-y-1.5">
            {actionItems.map((item) => {
              const SeverityGlyph =
                item.severity === "critical"
                  ? AlertOctagon
                  : item.severity === "warning"
                    ? AlertTriangle
                    : Info;
              const tone =
                item.severity === "critical"
                  ? "bg-destructive/10 text-destructive border-destructive/30"
                  : item.severity === "warning"
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-primary/10 text-primary border-primary/30";
              return (
                <li
                  key={item.id}
                  className={`flex items-start gap-3 rounded-md border px-3 py-2 ${tone}`}
                >
                  <SeverityGlyph
                    className="h-4 w-4 mt-0.5 shrink-0"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-snug text-foreground">
                      {item.title.replace(`${orgName}: `, "")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                      {item.detail}
                    </p>
                  </div>
                  {item.occurredAt ? (
                    <span className="text-[10px] text-muted-foreground tabular-nums shrink-0 whitespace-nowrap">
                      {formatDistanceToNow(new Date(item.occurredAt), {
                        addSuffix: true,
                      })}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </SectionCard>
      ) : null}

      <LaunchReadiness items={readinessItems} />

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard
          label="Modules"
          description="Toggles save instantly and are mirrored to the audit log."
        >
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6">
            {moduleRows.map(([key, label, enabled]) => (
              <ModuleToggle
                key={key}
                orgId={orgId}
                module={key}
                label={label}
                initialEnabled={enabled}
              />
            ))}
          </ul>
          {rentCastUsage ? (
            <div className="mt-4 pt-3 border-t border-[var(--hair)]">
              <RentCastUsageRow
                orgId={orgId}
                used={rentCastUsage.used}
                initialBudget={rentCastUsage.budget}
                monthKey={rentCastUsage.monthKey}
              />
            </div>
          ) : null}
        </SectionCard>

        <SectionCard label="Domains">
          <DomainsPanel
            orgId={orgId}
            fallbackSlug={fallbackSlug}
            initial={domains}
          />
        </SectionCard>

        <SectionCard
          label="Cursive (visitor identification)"
          description="Bind the V4 pixel and segment IDs from Cursive. The webhook URL below is what they need in their pixel settings."
          className="lg:col-span-2"
        >
          <CursivePanel
            orgId={orgId}
            webhookUrl={sharedWebhookUrl}
            tenantWebhookUrl={tenantWebhookUrl}
            initial={cursive}
          />
        </SectionCard>
      </section>
    </div>
  );
}
