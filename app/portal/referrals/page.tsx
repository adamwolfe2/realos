import type { Metadata } from "next";
import { Share2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
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
      <div className="rounded-xl border border-dashed border-[var(--border-cream)] bg-[var(--ivory)] p-12 text-center">
        <h2 className="text-base font-semibold text-[var(--near-black)]">
          Organization not found
        </h2>
      </div>
    );
  }

  if (!org.moduleReferrals) {
    return (
      <div className="space-y-5">
        <PageTitle />
        <div className="rounded-xl border border-dashed border-[var(--border-cream)] bg-[var(--ivory)] py-16 text-center px-6">
          <Share2 className="mx-auto h-7 w-7 text-[var(--stone-gray)]" />
          <h2 className="mt-3 text-lg font-semibold text-[var(--near-black)]">
            Referrals module not active
          </h2>
          <p className="mt-1 text-sm text-[var(--olive-gray)] max-w-md mx-auto">
            The resident referral program lets current residents share a unique
            link that tags incoming leads as referrals, so you can track which
            residents drive new leases. Contact your account manager to activate
            this module.
          </p>
          <a
            href="mailto:hello@leasestack.co?subject=Activate%20Referrals%20module"
            className="mt-5 inline-flex items-center rounded-md bg-[var(--near-black)] text-white px-4 py-2 text-sm font-medium hover:bg-black transition-colors"
          >
            Contact account manager
          </a>
        </div>
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

  // Collect all referral lead IDs to join applications
  const referralLeadIds = await prisma.lead
    .findMany({
      where: {
        ...tenantWhere(scope),
        source: "REFERRAL",
      },
      select: { id: true, propertyId: true },
    })
    .then((rows) => rows);

  // Group lead IDs by propertyId for application lookups
  const leadIdsByProperty = new Map<string, string[]>();
  for (const { id, propertyId } of referralLeadIds) {
    if (!propertyId) continue;
    const existing = leadIdsByProperty.get(propertyId) ?? [];
    leadIdsByProperty.set(propertyId, [...existing, id]);
  }

  // Fetch application and signed counts per property via lead IDs
  const appsByProperty = new Map<string, { apps: number; signed: number }>();
  await Promise.all(
    [...leadIdsByProperty.entries()].map(async ([propertyId, leadIds]) => {
      const [apps, signed] = await Promise.all([
        prisma.application.count({
          where: { leadId: { in: leadIds } },
        }),
        prisma.application.count({
          where: {
            leadId: { in: leadIds },
            status: "APPROVED",
          },
        }),
      ]);
      appsByProperty.set(propertyId, { apps, signed });
    })
  );

  // Build lookup maps
  const allTimeByProp = new Map(
    referralLeadsAll.map((r) => [r.propertyId ?? "", r._count.id])
  );
  const thirtyDayByProp = new Map(
    referralLeads30d.map((r) => [r.propertyId ?? "", r._count.id])
  );

  const stats: ReferralPropertyStat[] = properties.map((p) => ({
    propertyId: p.id,
    propertyName: p.name,
    propertySlug: p.slug,
    orgSlug: org.slug,
    referralLeads: allTimeByProp.get(p.id) ?? 0,
    referralLeads30d: thirtyDayByProp.get(p.id) ?? 0,
    referralApps: appsByProperty.get(p.id)?.apps ?? 0,
    referralSigned: appsByProperty.get(p.id)?.signed ?? 0,
  }));

  // Summary totals
  const totalLeads = stats.reduce((n, s) => n + s.referralLeads, 0);
  const totalLeads30d = stats.reduce((n, s) => n + s.referralLeads30d, 0);
  const totalApps = stats.reduce((n, s) => n + s.referralApps, 0);
  const totalSigned = stats.reduce((n, s) => n + s.referralSigned, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <PageTitle />
          <p className="text-sm text-[var(--olive-gray)] mt-1 max-w-xl">
            Per-property referral links for current residents to share with
            their network. Every lead that arrives via a referral link is tagged
            automatically so you can track which residents drive new leases.
          </p>
        </div>

        {/* Summary stat chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <Chip label="Total referral leads" value={totalLeads} />
          <Chip label="Last 30 days" value={totalLeads30d} accent />
          <Chip label="Applications" value={totalApps} />
          <Chip label="Signed" value={totalSigned} />
        </div>
      </div>

      {/* Per-property cards */}
      {stats.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border-cream)] bg-[var(--ivory)] py-16 text-center">
          <Share2 className="mx-auto h-6 w-6 text-[var(--stone-gray)]" />
          <h2 className="mt-3 text-base font-semibold text-[var(--near-black)]">
            No properties set up yet
          </h2>
          <p className="mt-1 text-sm text-[var(--olive-gray)] max-w-md mx-auto">
            Add a property under the Properties tab first. Each property gets
            its own referral link once it is set up.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {stats.map((s) => (
            <ReferralLinkCard key={s.propertyId} stat={s} />
          ))}
        </div>
      )}

      {/* How it works */}
      <div className="rounded-xl border border-[var(--border-cream)] bg-[var(--ivory)] p-5 space-y-3">
        <div className="text-[10px] uppercase tracking-widest font-semibold text-[var(--stone-gray)]">
          How it works
        </div>
        <ol className="space-y-2 text-sm text-[var(--olive-gray)] list-decimal list-inside">
          <li>
            Copy the referral link for a property and share it with current
            residents via text, email, or a flyer posted in common areas.
          </li>
          <li>
            When a prospect arrives through that link and submits the contact
            form, the lead is created with source set to{" "}
            <span className="font-mono text-[11px] bg-[var(--warm-sand)] px-1 py-0.5 rounded">
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

function PageTitle() {
  return (
    <div>
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-semibold text-[var(--stone-gray)]">
        <Share2 className="h-3 w-3" />
        Resident program
      </div>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--near-black)]">
        Referrals
      </h1>
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
        "min-w-16 rounded-lg border px-3 py-2 " +
        (accent
          ? "border-[var(--terracotta)] bg-[var(--terracotta)]/5"
          : "border-[var(--border-cream)] bg-[var(--ivory)]")
      }
    >
      <div className="text-[9px] uppercase tracking-widest font-semibold text-[var(--stone-gray)]">
        {label}
      </div>
      <div
        className={
          "mt-0.5 text-xl font-semibold tabular-nums " +
          (accent ? "text-[var(--terracotta)]" : "text-[var(--near-black)]")
        }
      >
        {value}
      </div>
    </div>
  );
}
