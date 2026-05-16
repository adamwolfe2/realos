import type { Metadata } from "next";
import { Share2 } from "lucide-react";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/portal/ui/empty-state";
import {
  ReferralLinkCard,
  type ReferralPropertyStat,
} from "./referral-link-card";

export const metadata: Metadata = { title: "Referrals" };
export const dynamic = "force-dynamic";

export default async function ReferralsPage() {
  const scope = await requireScope();

  const org = await prisma.organization.findUnique({
    where: { id: scope.orgId },
    select: {
      moduleReferrals: true,
      slug: true,
    },
  });

  if (!org) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
        <h2 className="text-base font-semibold text-foreground">
          Organization not found
        </h2>
      </div>
    );
  }

  if (!org.moduleReferrals) {
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow="Resident program"
          title="Referrals"
        />
        <EmptyState
          icon={<Share2 className="h-4 w-4" />}
          title="Referrals module not active"
          body="The resident referral program lets current residents share a unique link that tags incoming leads as referrals, so you can track which residents drive new leases. Contact your account manager to activate this module."
        />
      </div>
    );
  }

  const thirty_days_ago = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [properties, referralLeadsAll, referralLeads30d] = await Promise.all([
    prisma.property.findMany({
      where: tenantWhere(scope),
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    }),
    // All-time referral leads per property
    prisma.lead.groupBy({
      by: ["propertyId"],
      where: {
        ...tenantWhere(scope),
        source: "REFERRAL",
      },
      _count: { id: true },
    }),
    // Last-30d referral leads per property
    prisma.lead.groupBy({
      by: ["propertyId"],
      where: {
        ...tenantWhere(scope),
        source: "REFERRAL",
        createdAt: { gte: thirty_days_ago },
      },
      _count: { id: true },
    }),
  ]);

  // Fetch all applications joined to referral leads in TWO queries
  // total (one for applications, one for approved subset) instead of
  // 2N queries — N = property count. With SG Real Estate's 71
  // properties this is the difference between 142 sequential round-
  // trips and 2 parallel ones.
  //
  // We groupBy on the lead relation's propertyId. Applications without
  // a lead are excluded (they wouldn't show on a referrals page
  // anyway). The `lead` relation filter pushes the source/property
  // constraint into the same query.
  const [appsByLead, signedByLead] = await Promise.all([
    prisma.application.findMany({
      where: {
        lead: { ...tenantWhere(scope), source: "REFERRAL" },
      },
      select: { lead: { select: { propertyId: true } } },
    }),
    prisma.application.findMany({
      where: {
        lead: { ...tenantWhere(scope), source: "REFERRAL" },
        status: "APPROVED",
      },
      select: { lead: { select: { propertyId: true } } },
    }),
  ]);

  const appsByProperty = new Map<string, { apps: number; signed: number }>();
  for (const a of appsByLead) {
    const pid = a.lead.propertyId;
    if (!pid) continue;
    const cur = appsByProperty.get(pid) ?? { apps: 0, signed: 0 };
    cur.apps += 1;
    appsByProperty.set(pid, cur);
  }
  for (const a of signedByLead) {
    const pid = a.lead.propertyId;
    if (!pid) continue;
    const cur = appsByProperty.get(pid) ?? { apps: 0, signed: 0 };
    cur.signed += 1;
    appsByProperty.set(pid, cur);
  }

  // Build lookup maps
  const allTimeByProp = new Map(
    referralLeadsAll.map((r) => [r.propertyId ?? "", r._count.id])
  );
  const thirtyDayByProp = new Map(
    referralLeads30d.map((r) => [r.propertyId ?? "", r._count.id])
  );

  const baseStats = properties.map((p) => ({
    propertyId: p.id,
    propertyName: p.name,
    propertySlug: p.slug,
    orgSlug: org.slug,
    referralLeads: allTimeByProp.get(p.id) ?? 0,
    referralLeads30d: thirtyDayByProp.get(p.id) ?? 0,
    referralApps: appsByProperty.get(p.id)?.apps ?? 0,
    referralSigned: appsByProperty.get(p.id)?.signed ?? 0,
  }));

  // Generate QR codes server-side for each property
  const stats: ReferralPropertyStat[] = await Promise.all(
    baseStats.map(async (s) => {
      const referralUrl = `https://${s.orgSlug}.leasestack.co/contact?ref=${s.propertySlug}`;
      let qrDataUrl: string | null = null;
      try {
        qrDataUrl = await QRCode.toDataURL(referralUrl, {
          width: 200,
          margin: 1,
          color: { dark: "#111111", light: "#ffffff" },
        });
      } catch {
        // QR generation failure is non-fatal
      }
      return { ...s, qrDataUrl };
    })
  );

  // Summary totals
  const totalLeads = stats.reduce((n, s) => n + s.referralLeads, 0);
  const totalLeads30d = stats.reduce((n, s) => n + s.referralLeads30d, 0);
  const totalApps = stats.reduce((n, s) => n + s.referralApps, 0);
  const totalSigned = stats.reduce((n, s) => n + s.referralSigned, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Resident program"
        title="Referrals"
        description="Per-property referral links for current residents to share with their network. Every lead that arrives via a referral link is tagged automatically so you can track which residents drive new leases."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Chip label="Total referral leads" value={totalLeads} />
            <Chip label="Last 30 days" value={totalLeads30d} accent />
            <Chip label="Applications" value={totalApps} />
            <Chip label="Signed" value={totalSigned} />
          </div>
        }
      />

      {/* Per-property cards */}
      {stats.length === 0 ? (
        <EmptyState
          icon={<Share2 className="h-4 w-4" />}
          title="No properties set up yet"
          body="Add a property under the Properties tab first. Each property gets its own referral link once it is set up."
          action={{ label: "Add a property", href: "/portal/properties" }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stats.map((s) => (
            <ReferralLinkCard key={s.propertyId} stat={s} />
          ))}
        </div>
      )}

      {/* How it works */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">
          How it works
        </div>
        <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
          <li>
            Copy the referral link for a property and share it with current
            residents via text, email, or a flyer posted in common areas.
          </li>
          <li>
            When a prospect arrives through that link and submits the contact
            form, the lead is created with source set to{" "}
            <span className="font-mono text-[11px] bg-muted px-1 py-0.5 rounded">
              REFERRAL
            </span>
            .
          </li>
          <li>
            Track referral performance here. Leads, applications, and signed
            leases from referrals are counted per property.
          </li>
        </ol>
      </div>
    </div>
  );
}

function Chip({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div
      className={
        "min-w-16 rounded-xl border px-3 py-2 " +
        (accent
          ? "border-primary bg-primary/5"
          : "border-border bg-card")
      }
    >
      <div className="text-[9px] uppercase tracking-widest font-semibold text-muted-foreground">
        {label}
      </div>
      <div
        className={
          "mt-0.5 text-xl font-semibold tabular-nums " +
          (accent ? "text-primary" : "text-foreground")
        }
      >
        {value}
      </div>
    </div>
  );
}
