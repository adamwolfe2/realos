import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAgency } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { OrgType } from "@prisma/client";
import { ImpersonateButton } from "./impersonate-button";
import { ProvisionPixelButton } from "./provision-pixel-button";
import { ModuleToggle } from "./module-toggle";
import { CursivePanel } from "./cursive-panel";
import type { ToggleableModule } from "@/lib/actions/admin-modules";
import { headers } from "next/headers";
import { StatCard } from "@/components/admin/stat-card";
import { StatusBadge, ToggleIndicator } from "@/components/admin/status-badge";
import { PageHeader, SectionCard } from "@/components/admin/page-header";
import {
  humanTenantStatus,
  tenantStatusTone,
  humanLeadStatus,
  leadStatusTone,
  humanLeadSource,
  humanPropertyType,
  humanResidentialSubtype,
  humanCommercialSubtype,
  humanSubscriptionTier,
  humanAuditAction,
} from "@/lib/format";
import { formatDistanceToNow } from "date-fns";

export const metadata: Metadata = { title: "Client detail" };
export const dynamic = "force-dynamic";

export default async function ClientDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAgency();
  const { id } = await params;

  const org = await prisma.organization.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          properties: true,
          leads: true,
          visitors: true,
          chatbotConversations: true,
          creativeRequests: true,
          users: true,
          adCampaigns: true,
          domains: true,
        },
      },
      properties: {
        include: { _count: { select: { listings: true } } },
        take: 20,
        orderBy: { updatedAt: "desc" },
      },
      domains: true,
      tenantSiteConfig: true,
      cursiveIntegration: true,
      projects: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { _count: { select: { tasks: true, notes: true } } },
      },
      clientNotes: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });
  if (!org || org.orgType !== OrgType.CLIENT) notFound();

  const moduleRows: Array<[ToggleableModule, string, boolean]> = [
    ["moduleWebsite", "Website", org.moduleWebsite],
    ["moduleLeadCapture", "Lead capture", org.moduleLeadCapture],
    ["modulePixel", "Visitor pixel", org.modulePixel],
    ["moduleChatbot", "AI chatbot", org.moduleChatbot],
    ["moduleGoogleAds", "Google Ads", org.moduleGoogleAds],
    ["moduleMetaAds", "Meta Ads", org.moduleMetaAds],
    ["moduleSEO", "SEO", org.moduleSEO],
    ["moduleEmail", "Email nurture", org.moduleEmail],
    ["moduleOutboundEmail", "Outbound email", org.moduleOutboundEmail],
    ["moduleReferrals", "Referrals", org.moduleReferrals],
    ["moduleCreativeStudio", "Creative studio", org.moduleCreativeStudio],
  ];

  const recentLeads = await prisma.lead.findMany({
    where: { orgId: org.id },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { property: { select: { name: true } } },
  });

  const recentAudits = await prisma.auditEvent.findMany({
    where: { orgId: org.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const propertyTypeLabel = [
    humanPropertyType(org.propertyType),
    org.residentialSubtype
      ? humanResidentialSubtype(org.residentialSubtype)
      : org.commercialSubtype
        ? humanCommercialSubtype(org.commercialSubtype)
        : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <Link
            href="/admin/clients"
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <span aria-hidden="true">←</span> All clients
          </Link>
        }
        title={org.name}
        description={
          <span className="flex items-center gap-2 flex-wrap">
            <span>{propertyTypeLabel}</span>
            <span className="text-muted-foreground/60">·</span>
            <StatusBadge tone={tenantStatusTone(org.status)}>
              {humanTenantStatus(org.status)}
            </StatusBadge>
            {org.subscriptionTier ? (
              <>
                <span className="text-muted-foreground/60">·</span>
                <span className="text-xs">
                  {humanSubscriptionTier(org.subscriptionTier)} tier
                </span>
              </>
            ) : null}
          </span>
        }
        actions={
          <>
            {org.modulePixel ? (
              <ProvisionPixelButton
                orgId={org.id}
                hasPixel={!!org.cursiveIntegration?.cursivePixelId}
              />
            ) : null}
            <ImpersonateButton orgId={org.id} />
          </>
        }
      />

      {org.primaryContactName ? (
        <p className="text-xs text-muted-foreground -mt-2">
          {org.primaryContactName}
          {org.primaryContactEmail ? ` · ${org.primaryContactEmail}` : ""}
          {org.primaryContactPhone ? ` · ${org.primaryContactPhone}` : ""}
        </p>
      ) : null}

      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Properties" value={org._count.properties} />
        <StatCard label="Leads" value={org._count.leads} />
        <StatCard label="Visitors" value={org._count.visitors} />
        <StatCard label="Chats" value={org._count.chatbotConversations} />
        <StatCard label="Ad campaigns" value={org._count.adCampaigns} />
        <StatCard label="Domains" value={org._count.domains} />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard
          label="Modules"
          description="Toggles save instantly and are mirrored to the audit log."
        >
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6">
            {moduleRows.map(([key, label, enabled]) => (
              <ModuleToggle
                key={key}
                orgId={org.id}
                module={key}
                label={label}
                initialEnabled={enabled}
              />
            ))}
          </ul>
        </SectionCard>

        <SectionCard label="Domains">
          {org.domains.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No custom domain attached. Fallback:{" "}
              <code className="text-foreground">
                {org.slug}.realestaite.co
              </code>
            </p>
          ) : (
            <ul className="space-y-2">
              {org.domains.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between gap-3 py-1"
                >
                  <span className="text-sm font-medium text-foreground truncate">
                    {d.hostname}
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    {d.isPrimary ? (
                      <StatusBadge tone="info" dot={false}>
                        Primary
                      </StatusBadge>
                    ) : null}
                    <StatusBadge
                      tone={d.sslStatus === "active" ? "success" : "neutral"}
                    >
                      {d.sslStatus ?? "Pending"}
                    </StatusBadge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          label="Cursive (visitor identification)"
          description="Bind the V4 pixel and segment IDs from Cursive. The webhook URL below is what they need in their pixel settings."
          className="lg:col-span-2"
        >
          <CursivePanel
            orgId={org.id}
            webhookUrl={`${(await headers()).get("x-forwarded-proto") ?? "https"}://${(await headers()).get("host") ?? "realos-nine.vercel.app"}/api/webhooks/cursive`}
            initial={{
              cursivePixelId: org.cursiveIntegration?.cursivePixelId ?? null,
              cursiveSegmentId: org.cursiveIntegration?.cursiveSegmentId ?? null,
              installedOnDomain: org.cursiveIntegration?.installedOnDomain ?? null,
              publicSiteKey: org.cursiveIntegration?.publicSiteKey ?? null,
              publicKeyPrefix: org.cursiveIntegration?.publicKeyPrefix ?? null,
              lastEventAt: org.cursiveIntegration?.lastEventAt
                ? org.cursiveIntegration.lastEventAt.toISOString()
                : null,
              lastSegmentSyncAt: org.cursiveIntegration?.lastSegmentSyncAt
                ? org.cursiveIntegration.lastSegmentSyncAt.toISOString()
                : null,
              totalEventsCount: org.cursiveIntegration?.totalEventsCount ?? 0,
            }}
          />
        </SectionCard>

        <SectionCard label="Properties">
          {org.properties.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No properties set up yet.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {org.properties.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-foreground truncate">
                      {p.name}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      /{p.slug}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {p._count.listings} listing
                    {p._count.listings === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard label="Active project">
          {org.projects.length === 0 ? (
            <p className="text-xs text-muted-foreground">No active project.</p>
          ) : (
            <ul className="space-y-2">
              {org.projects.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 py-1 text-sm"
                >
                  <span className="text-foreground truncate">{p.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {p._count.tasks} task
                    {p._count.tasks === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

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

        <SectionCard label="Recent activity">
          {recentAudits.length === 0 ? (
            <p className="text-xs text-muted-foreground">No activity yet.</p>
          ) : (
            <ul className="space-y-3">
              {recentAudits.map((a) => (
                <li
                  key={a.id}
                  className="text-sm flex items-start gap-3 min-w-0"
                >
                  <span
                    aria-hidden="true"
                    className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/40 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-foreground">
                      {humanAuditAction(a.action)}
                      {a.entityType ? (
                        <span className="text-muted-foreground">
                          {" · "}
                          {a.entityType}
                        </span>
                      ) : null}
                    </div>
                    {a.description ? (
                      <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                        {a.description}
                      </div>
                    ) : null}
                  </div>
                  <span className="text-[11px] text-muted-foreground shrink-0">
                    {formatDistanceToNow(a.createdAt, { addSuffix: true })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </section>
    </div>
  );
}
