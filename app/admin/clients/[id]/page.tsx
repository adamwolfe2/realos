import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAgency } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { OrgType } from "@prisma/client";
import { ImpersonateButton } from "./impersonate-button";
import { ModuleToggle } from "./module-toggle";
import { CursivePanel } from "./cursive-panel";
import { DomainsPanel } from "./domains-panel";
import { InviteUserButton } from "./invite-user-button";
import { LaunchReadiness } from "./launch-readiness";
import { TeamPanel } from "./team-panel";
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
      // Per-property migration renamed cursiveIntegration → cursiveIntegrations
      // (1:many). Pull the legacy org-wide row (propertyId = NULL) plus
      // every per-property row; the admin UI surfaces the legacy one as
      // the org's primary pixel and the rest as scoped overrides.
      cursiveIntegrations: {
        orderBy: [{ propertyId: "asc" }, { createdAt: "asc" }],
      },
      appfolioIntegration: {
        select: {
          instanceSubdomain: true,
          syncStatus: true,
          lastSyncAt: true,
          lastError: true,
        },
      },
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

  // After the per-property integration migration the legacy "this is the
  // org's pixel" row is the one with propertyId = NULL. The admin client
  // panel shows that as the primary pixel so existing UX stays intact.
  const cursiveLegacy =
    org.cursiveIntegrations.find((c) => c.propertyId === null) ?? null;

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

  const teamMembers = await prisma.user.findMany({
    where: { orgId: org.id },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      clerkUserId: true,
      lastLoginAt: true,
      createdAt: true,
    },
    take: 100,
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
            <InviteUserButton
              orgId={org.id}
              clerkOrgId={org.clerkOrgId}
              suggestedEmail={org.primaryContactEmail}
              suggestedName={org.primaryContactName}
            />
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

      <LaunchReadiness
        items={[
          {
            label: "Clerk org linked",
            status: org.clerkOrgId ? "ok" : "missing",
            hint: org.clerkOrgId
              ? undefined
              : "Convert the intake or re-provision to create the Clerk org.",
          },
          {
            label: "Primary contact email",
            status: org.primaryContactEmail ? "ok" : "missing",
            hint: org.primaryContactEmail ?? "Add a primary contact before inviting.",
          },
          {
            label: "At least one team member",
            status: org._count.users > 0 ? "ok" : "warn",
            hint:
              org._count.users > 0
                ? `${org._count.users} user${org._count.users === 1 ? "" : "s"}`
                : "No users yet. Sending an invite counts.",
          },
          {
            label: "Primary property added",
            status: org._count.properties > 0 ? "ok" : "missing",
            href: "/admin/clients/" + org.id,
            hint:
              org._count.properties > 0
                ? `${org._count.properties} propert${org._count.properties === 1 ? "y" : "ies"}`
                : "At least one Property is required for listings.",
          },
          {
            label: "Custom domain attached",
            status: org.domains.length > 0 ? "ok" : "warn",
            hint:
              org.domains.length > 0
                ? org.domains.map((d) => d.hostname).join(", ")
                : "Fallback is {slug}.leasestack.co — configure a real hostname soon.",
          },
          {
            label: "Cursive pixel provisioned",
            status: cursiveLegacy?.cursivePixelId ? "ok" : "missing",
            hint: cursiveLegacy?.cursivePixelId
              ? `Pixel ${cursiveLegacy.cursivePixelId}`
              : "Click 'Provision pixel' above.",
          },
          {
            label: "Pixel enabled on tenant site",
            status: org.tenantSiteConfig?.enablePixel ? "ok" : "warn",
            hint: org.tenantSiteConfig?.enablePixel
              ? "Rendering on the live site."
              : "Client toggles this in Site builder — we can pre-enable.",
          },
          {
            label: "Chatbot enabled on tenant site",
            status: org.tenantSiteConfig?.chatbotEnabled ? "ok" : "warn",
            hint: org.tenantSiteConfig?.chatbotEnabled
              ? "Loader renders on the live site."
              : "Client toggles this from /portal/chatbot.",
          },
          {
            label: "AppFolio connected",
            status: org.appfolioIntegration?.lastSyncAt ? "ok" : "warn",
            hint: org.appfolioIntegration?.lastSyncAt
              ? `Last sync ${org.appfolioIntegration.lastSyncAt.toISOString().slice(0, 10)}`
              : "Client pastes credentials in /portal/settings/integrations.",
          },
          {
            label: "Brand colors + logo",
            status:
              org.logoUrl && org.primaryColor ? "ok" : org.logoUrl || org.primaryColor ? "warn" : "warn",
            hint:
              org.logoUrl && org.primaryColor
                ? "Portal is branded."
                : "Client sets these in /portal/settings.",
          },
        ]}
      />

      <SectionCard
        label="Team members"
        description="Roles are enforced immediately. Removing a user revokes their Clerk session and any pending invites for that email."
      >
        <TeamPanel members={teamMembers} />
      </SectionCard>

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
          <DomainsPanel
            orgId={org.id}
            fallbackSlug={org.slug}
            initial={org.domains.map((d) => ({
              id: d.id,
              hostname: d.hostname,
              isPrimary: d.isPrimary,
              sslStatus: d.sslStatus,
              dnsConfigured: d.dnsConfigured,
            }))}
          />
        </SectionCard>

        <SectionCard
          label="Cursive (visitor identification)"
          description="Bind the V4 pixel and segment IDs from Cursive. The webhook URL below is what they need in their pixel settings."
          className="lg:col-span-2"
        >
          {await (async () => {
            const hdrs = await headers();
            const proto = hdrs.get("x-forwarded-proto") ?? "https";
            const host = hdrs.get("host") ?? "leasestack.co";
            const sharedWebhookUrl = `${proto}://${host}/api/webhooks/cursive`;
            const tenantWebhookUrl = cursiveLegacy?.webhookToken
              ? `${proto}://${host}/api/webhooks/cursive/${cursiveLegacy.webhookToken}`
              : null;
            return (
              <CursivePanel
                orgId={org.id}
                webhookUrl={sharedWebhookUrl}
                tenantWebhookUrl={tenantWebhookUrl}
                initial={{
                  cursivePixelId: cursiveLegacy?.cursivePixelId ?? null,
                  cursiveSegmentId:
                    cursiveLegacy?.cursiveSegmentId ?? null,
                  installedOnDomain:
                    cursiveLegacy?.installedOnDomain ?? null,
                  lastEventAt: cursiveLegacy?.lastEventAt
                    ? cursiveLegacy.lastEventAt.toISOString()
                    : null,
                  lastSegmentSyncAt: cursiveLegacy?.lastSegmentSyncAt
                    ? cursiveLegacy.lastSegmentSyncAt.toISOString()
                    : null,
                  totalEventsCount:
                    cursiveLegacy?.totalEventsCount ?? 0,
                }}
              />
            );
          })()}
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

        {org.appfolioIntegration ? (
          <SectionCard label="AppFolio sync">
            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-xs font-medium text-muted-foreground">
                  Subdomain
                </dt>
                <dd className="font-mono text-[12px] text-foreground">
                  {org.appfolioIntegration.instanceSubdomain}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-xs font-medium text-muted-foreground">
                  Status
                </dt>
                <dd className="text-foreground">
                  {org.appfolioIntegration.syncStatus ?? "idle"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-xs font-medium text-muted-foreground">
                  Last sync
                </dt>
                <dd className="text-foreground">
                  {org.appfolioIntegration.lastSyncAt
                    ? formatDistanceToNow(org.appfolioIntegration.lastSyncAt, {
                        addSuffix: true,
                      })
                    : "Never"}
                </dd>
              </div>
            </dl>
            {org.appfolioIntegration.lastError ? (
              <p className="mt-3 text-[11px] text-rose-700 rounded-md border border-rose-200 bg-rose-50 p-2 break-words">
                {org.appfolioIntegration.lastError}
              </p>
            ) : null}
          </SectionCard>
        ) : null}

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
