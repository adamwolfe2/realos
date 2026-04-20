import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireScope } from "@/lib/tenancy/scope";
import { SettingsForm } from "./settings-form";
import { PageHeader } from "@/components/admin/page-header";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const scope = await requireScope();
  const [org, users] = await Promise.all([
    prisma.organization.findUnique({ where: { id: scope.orgId } }),
    prisma.user.findMany({
      where: { orgId: scope.orgId },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  if (!org) return null;

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

  return (
    <div className="space-y-8 max-w-3xl">
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

      <section className="border rounded-md p-5">
        <div className="flex items-baseline justify-between gap-3 mb-2">
          <div>
            <h2 className="text-sm font-semibold">Integrations</h2>
            <p className="text-xs opacity-60 mt-1">
              Connect the Cursive visitor pixel and other third-party
              services.
            </p>
          </div>
          <Link
            href="/portal/settings/integrations"
            className="text-xs underline underline-offset-2 opacity-80 shrink-0"
          >
            Integrations →
          </Link>
        </div>
      </section>

      <section className="border rounded-md p-5">
        <div className="flex items-baseline justify-between gap-3 mb-2">
          <div>
            <h2 className="text-sm font-semibold">API keys</h2>
            <p className="text-xs opacity-60 mt-1">
              Generate scoped API keys so Zapier, Typeform, and bespoke
              systems can push leads, visitors, tours, and chatbot events
              into your CRM.
            </p>
          </div>
          <Link
            href="/portal/settings/api-keys"
            className="text-xs underline underline-offset-2 opacity-80 shrink-0"
          >
            API keys →
          </Link>
        </div>
      </section>

      <section className="border rounded-md p-5">
        <h2 className="text-sm font-semibold mb-4">Active modules</h2>
        <ul className="grid grid-cols-2 md:grid-cols-3 gap-y-1.5 gap-x-4">
          {modules.map(([k, v]) => (
            <li
              key={k}
              className="flex items-center justify-between gap-3 text-xs"
            >
              <span>{k}</span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] ${
                  v
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {v ? "On" : "Off"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="border rounded-md p-5">
        <h2 className="text-sm font-semibold mb-4">Team</h2>
        {users.length === 0 ? (
          <p className="text-sm opacity-60">
            No users yet. Invite teammates from the Clerk dashboard.
          </p>
        ) : (
          <ul className="divide-y text-sm">
            {users.map((u) => (
              <li key={u.id} className="py-2 flex items-baseline justify-between">
                <span>
                  {[u.firstName, u.lastName].filter(Boolean).join(" ") ||
                    u.email}
                  <span className="text-[11px] opacity-60 ml-2">{u.email}</span>
                </span>
                <span className="text-[11px] opacity-70">{u.role}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs opacity-60 mt-3">
          Inviting + role changes happen in the Clerk dashboard. Sprint 10
          adds in-portal invite + role management.
        </p>
      </section>
    </div>
  );
}
