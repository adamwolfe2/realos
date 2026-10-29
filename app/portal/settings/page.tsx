import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, KeyRound, Palette, Plug, ScrollText, Boxes } from "lucide-react";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireScope } from "@/lib/tenancy/scope";
import { getConnectStatusForOrg } from "@/lib/connect/status";
import { SettingsForm } from "./settings-form";
import { ClientTeamPanel } from "./team-panel";
import { LeadNotifySettings } from "@/components/portal/settings/lead-notify-settings";
import { PageTitle, Panel, Pill } from "@/components/portal/overview/kit";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const scope = await requireScope();
  const [org, users, viewer, apiKeyCount, integrationsActive, properties] =
    await Promise.all([
      prisma.organization.findUnique({ where: { id: scope.orgId } }),
      prisma.user.findMany({
        where: { orgId: scope.orgId },
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          clerkUserId: true,
          lastLoginAt: true,
          // Property-level access grants. Empty array = unrestricted
          // org-wide access (legacy default for every existing user).
          propertyAccess: {
            select: { propertyId: true },
          },
        },
      }),
      prisma.user.findUnique({
        where: { clerkUserId: scope.clerkUserId },
        select: { id: true, role: true },
      }),
      prisma.apiKey.count({
        where: { orgId: scope.orgId, revokedAt: null },
      }),
      countActiveIntegrations(scope.orgId),
      // Property list for the per-user property-access editor in the
      // team panel. Always the full org list (admins see/edit access
      // for everyone — they're not subject to UserPropertyAccess
      // themselves at this org-management layer).
      prisma.property.findMany({
        where: { orgId: scope.orgId },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);

  if (!org) return null;

  const canManage =
    viewer?.role === UserRole.CLIENT_OWNER ||
    viewer?.role === UserRole.CLIENT_ADMIN ||
    viewer?.role === UserRole.AGENCY_OWNER ||
    viewer?.role === UserRole.AGENCY_ADMIN;

  const modules: Array<[string, boolean]> = [
    ["Website", org.moduleWebsite],
    ["Lead capture", org.moduleLeadCapture],
    ["Chatbot", org.moduleChatbot],
    ["Google Ads", org.moduleGoogleAds],
    ["Meta Ads", org.moduleMetaAds],
    ["SEO", org.moduleSEO],
    ["Email nurture", org.moduleEmail],
    ["Outbound email", org.moduleOutboundEmail],
    ["Referrals", org.moduleReferrals],
    ["Creative studio", org.moduleCreativeStudio],
  ];

  const onCount = modules.filter(([, v]) => v).length;

  return (
    <div className="w-full space-y-5">
      <PageTitle
        title="Settings"
        subtitle={`${org.name} · ${onCount} of ${modules.length} modules on`}
      />

      <SettingsForm
        initial={{
          name: org.name,
          shortName: org.shortName,
          primaryContactName: org.primaryContactName,
          primaryContactEmail: org.primaryContactEmail,
          primaryContactPhone: org.primaryContactPhone,
          primaryContactRole: org.primaryContactRole,
          hqAddressLine1: org.hqAddressLine1,
          hqCity: org.hqCity,
          hqState: org.hqState,
          hqPostalCode: org.hqPostalCode,
          logoUrl: org.logoUrl,
          primaryColor: org.primaryColor,
          secondaryColor: org.secondaryColor,
          brandFont: org.brandFont,
        }}
        below={
        <Panel title="Workspace" flush>
          <ul className="divide-y divide-[var(--t-divider)]">
            <NavRow href="/portal/connect" icon={<Plug className="size-4" aria-hidden="true" />} title="Connect data" description="AppFolio, Google, Meta and your website" stat={`${integrationsActive} connected`} />
            <NavRow href="/portal/marketplace" icon={<Boxes className="size-4" aria-hidden="true" />} title="Marketplace" description="Add-on modules" stat={`${onCount} of ${modules.length} active`} />
            <NavRow href="/portal/settings/api-keys" icon={<KeyRound className="size-4" aria-hidden="true" />} title="API keys" description="Push leads and tours from Zapier or your own systems" stat={`${apiKeyCount} active`} />
            <NavRow href="/portal/settings/white-label" icon={<Palette className="size-4" aria-hidden="true" />} title="White-label" description="Your branding on the portal, site and emails" stat={org.whiteLabel ? "Active" : "Off"} />
            <NavRow href="/portal/settings/audit-log" icon={<ScrollText className="size-4" aria-hidden="true" />} title="Audit log" description="Who changed what in this workspace" />
          </ul>
        </Panel>
        }
      />

      {canManage ? (
        <LeadNotifySettings
          initial={{
            notifyLeadEmail: org.notifyLeadEmail,
            notifyLeadCcEmail: org.notifyLeadCcEmail,
            notifyLeadBccEmail: org.notifyLeadBccEmail,
            notifyOnChatbotLead: org.notifyOnChatbotLead,
            notifyOnPopupLead: org.notifyOnPopupLead,
            notifyOnFormLead: org.notifyOnFormLead,
            notifyOnIngestLead: org.notifyOnIngestLead,
            notifyOnTourRequest: org.notifyOnTourRequest,
            notifyOnManualLead: org.notifyOnManualLead,
          }}
        />
      ) : null}

        <Panel title="Modules" aside={`${onCount} of ${modules.length} on · ask your account manager to change`}>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3 lg:grid-cols-5">
            {modules.map(([k, v]) => (
              <li key={k} className={v ? "" : "opacity-60"}>
                <Pill tone={v ? "good" : "neutral"}>
                  {k}
                  {v ? null : " · off"}
                </Pill>
              </li>
            ))}
          </ul>
        </Panel>

      <Panel
        title={<span id="team" className="scroll-mt-24">Team</span>}
        aside="Owners and admins manage billing and settings"
      >
        <ClientTeamPanel
          members={users.map((u) => ({
            ...u,
            propertyIds: u.propertyAccess.map((a) => a.propertyId),
          }))}
          properties={properties}
          orgId={org.id}
          canManage={canManage}
          viewerUserId={viewer?.id ?? ""}
        />
      </Panel>
    </div>
  );
}

function NavRow({
  href,
  icon,
  title,
  description,
  stat,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  stat?: string;
}) {
  return (
    <li>
      <Link href={href} className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--t-wash)]">
        <span className="text-[var(--t-muted)]">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-medium text-[var(--t-ink)]">{title}</span>
          <span className="block truncate text-[12px] text-[var(--t-muted)]">{description}</span>
        </span>
        {stat ? <span className="shrink-0 text-[12px] tabular-nums text-[var(--t-muted)]">{stat}</span> : null}
        <ChevronRight className="size-3.5 shrink-0 text-[var(--t-muted)] transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </Link>
    </li>
  );
}

async function countActiveIntegrations(orgId: string): Promise<number> {
  // Norman bug #107: this count had drifted from the /portal/connect
  // surface — settings reported "3 connected" while connect showed 6.
  // Root cause: ad-hoc per-table queries here vs. the canonical
  // getConnectStatusForOrg logic on the connect hub used different
  // truthiness rules per source. Consolidating on the same source so
  // the two pages can never disagree again.
  const sources = await getConnectStatusForOrg(orgId);
  return sources.filter((s) => s.connected).length;
}
