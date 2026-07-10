import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  KeyRound,
  Plug,
  Users,
  Check,
  Palette,
} from "lucide-react";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireScope } from "@/lib/tenancy/scope";
import { getConnectStatusForOrg } from "@/lib/connect/status";
import { SettingsForm } from "./settings-form";
import { ClientTeamPanel } from "./team-panel";
import { LeadNotifySettings } from "@/components/portal/settings/lead-notify-settings";
import { PageHeader } from "@/components/admin/page-header";

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
    ["Pixel", org.modulePixel],
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
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Update company info and brand tokens. Module selection and plan tier are managed by your account manager."
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
            notifyOnVisitorConvert: org.notifyOnVisitorConvert,
            notifyOnManualLead: org.notifyOnManualLead,
          }}
        />
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <NavCard
          href="/portal/connect"
          icon={<Plug className="size-4" aria-hidden="true" />}
          title="Connect data"
          description="The unified hub for AppFolio, Google Analytics, Search Console, Google + Meta Ads, the Cursive pixel, and your website. Each connection unlocks new insight categories."
          stat={`${integrationsActive} connected`}
        />
        <NavCard
          href="/portal/marketplace"
          icon={<Boxes className="size-4" aria-hidden="true" />}
          title="Marketplace"
          description="Activate add-on modules — every module is free to try during your trial (excluding Pro add-ons)."
          stat={`${onCount} of ${modules.length} active`}
        />
        <NavCard
          href="/portal/settings/api-keys"
          icon={<KeyRound className="size-4" aria-hidden="true" />}
          title="API keys"
          description="Generate scoped keys so Zapier, Typeform, and bespoke systems can push leads, visitors, tours, and chatbot events into your CRM."
          stat={`${apiKeyCount} active`}
        />
        <NavCard
          href="/portal/settings/white-label"
          icon={<Palette className="size-4" aria-hidden="true" />}
          title="White-label"
          description="Swap LeaseStack branding for your own across the portal, public tenant site, and outbound emails. Requires the $499/mo add-on."
          stat={org.whiteLabel ? "Active" : "Off"}
        />
      </div>

      <section className="rounded-xl border border-border bg-card p-5">
        <header className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Boxes className="size-4" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Active modules
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {onCount} of {modules.length} enabled. Contact your account
                manager to add or remove modules.
              </p>
            </div>
          </div>
        </header>
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {modules.map(([k, v]) => (
            <li
              key={k}
              className={`flex items-center gap-2.5 rounded-md border px-3 py-2 text-xs ${
                v
                  ? "border-primary/30 bg-primary/10 text-foreground"
                  : "border-border bg-background text-muted-foreground"
              }`}
            >
              <span
                className={`inline-flex size-4 shrink-0 items-center justify-center rounded-full ${
                  v ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}
                aria-hidden="true"
              >
                {v ? <Check className="size-3" /> : null}
              </span>
              <span className="truncate font-medium">{k}</span>
              <span
                className={`ml-auto text-[10px] uppercase tracking-widest ${
                  v ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {v ? "On" : "Off"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section
        id="team"
        className="rounded-xl border border-border bg-card p-5 scroll-mt-24"
      >
        <header className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Users className="size-4" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Team</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Invite teammates and assign roles. Owners + Admins can manage
                billing and settings.
              </p>
            </div>
          </div>
        </header>
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
      </section>
    </div>
  );
}

function NavCard({
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
    <Link
      href={href}
      className="group rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/30 hover:bg-primary/[0.02]"
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary transition-colors">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            {stat ? (
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {stat}
              </span>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            {description}
          </p>
          <span className="inline-flex items-center gap-1 mt-3 text-xs font-medium text-foreground group-hover:text-primary">
            Manage
            <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
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
