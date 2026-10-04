import type { Metadata } from "next";
import { Flame } from "lucide-react";
import { requireAgency } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/admin/page-header";

export const metadata: Metadata = { title: "Audit leads" };
export const dynamic = "force-dynamic";

// /admin/audit-leads: read-only list of /audit lead-magnet prospects, newest
// first, capped at 200. Hot = viewed 3+ times (a prospect coming back to their
// own report).
const HOT_VIEWS = 3;
const LIMIT = 200;

const dateFmt = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

const HEAD_STYLE = {
  color: "#6B7280",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
} as const;

export default async function AdminAuditLeadsPage() {
  await requireAgency();

  const audits = await prisma.prospectAudit.findMany({
    orderBy: { createdAt: "desc" },
    take: LIMIT,
    select: {
      id: true,
      domain: true,
      email: true,
      overallScore: true,
      viewCount: true,
      lastViewedAt: true,
      createdAt: true,
      competitorName: true,
    },
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Audit leads"
        description={`Prospects who ran the free audit. Newest ${LIMIT}, highlighted when they have viewed their report ${HOT_VIEWS}+ times.`}
      />
      <section
        className="rounded-card border bg-white"
        style={{ borderColor: "#E5E7EB" }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead>
              <tr className="text-left" style={HEAD_STYLE}>
                <th className="px-5 py-2.5 font-medium">Domain</th>
                <th className="px-5 py-2.5 font-medium">Email</th>
                <th className="px-5 py-2.5 text-right font-medium">Score</th>
                <th className="px-5 py-2.5 font-medium">Views</th>
                <th className="px-5 py-2.5 font-medium">Last viewed</th>
                <th className="px-5 py-2.5 font-medium">Created</th>
                <th className="px-5 py-2.5 font-medium">Competitor</th>
              </tr>
            </thead>
            <tbody>
              {audits.map((a) => (
                <tr key={a.id} style={{ borderTop: "1px solid #E5E7EB" }}>
                  <td className="px-5 py-3 font-medium">{a.domain}</td>
                  <td className="px-5 py-3">{a.email ?? "-"}</td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    {a.overallScore ?? "-"}
                  </td>
                  <td className="px-5 py-3">
                    {a.viewCount >= HOT_VIEWS ? (
                      <span
                        className="inline-flex items-center gap-1 font-semibold"
                        style={{ color: "#0F62FE" }}
                      >
                        <Flame size={14} aria-hidden="true" />
                        viewed {a.viewCount} times
                      </span>
                    ) : (
                      <span className="tabular-nums">{a.viewCount}</span>
                    )}
                  </td>
                  <td className="px-5 py-3" style={{ color: "#6B7280" }}>
                    {a.lastViewedAt ? dateFmt.format(a.lastViewedAt) : "-"}
                  </td>
                  <td className="px-5 py-3" style={{ color: "#6B7280" }}>
                    {dateFmt.format(a.createdAt)}
                  </td>
                  <td className="px-5 py-3">{a.competitorName ?? "-"}</td>
                </tr>
              ))}
              {audits.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-8 text-center text-sm"
                    style={{ color: "var(--color-muted-foreground)" }}
                  >
                    No audits yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
