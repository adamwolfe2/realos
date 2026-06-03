import type { Metadata } from "next";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Prisma, ProposalStatus } from "@prisma/client";
import { requireAgency } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { StatusBadge } from "@/components/admin/status-badge";
import type { BadgeTone } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  formatCents,
  allocateDiscountCentsShared,
} from "@/lib/proposals/totals-shared";

export const metadata: Metadata = { title: "Proposals" };
export const dynamic = "force-dynamic";

type FilterKey =
  | "open"
  | "draft"
  | "sent"
  | "accepted"
  | "declined"
  | "expired"
  | "all";

function parseFilter(v: string | undefined): FilterKey {
  switch (v) {
    case "draft":
    case "sent":
    case "accepted":
    case "declined":
    case "expired":
    case "all":
    case "open":
      return v;
    default:
      return "open";
  }
}

function whereForFilter(f: FilterKey): Prisma.ProposalWhereInput {
  switch (f) {
    case "draft":
      return { status: ProposalStatus.DRAFT };
    case "sent":
      return { status: { in: [ProposalStatus.SENT, ProposalStatus.VIEWED] } };
    case "accepted":
      return { status: ProposalStatus.ACCEPTED };
    case "declined":
      return {
        status: { in: [ProposalStatus.DECLINED, ProposalStatus.CANCELED] },
      };
    case "expired":
      return { status: ProposalStatus.EXPIRED };
    case "all":
      return {};
    case "open":
    default:
      return {
        status: {
          in: [
            ProposalStatus.DRAFT,
            ProposalStatus.SENT,
            ProposalStatus.VIEWED,
          ],
        },
      };
  }
}

function statusTone(s: ProposalStatus): BadgeTone {
  switch (s) {
    case ProposalStatus.ACCEPTED:
      return "success";
    case ProposalStatus.SENT:
    case ProposalStatus.VIEWED:
      return "warning";
    case ProposalStatus.DECLINED:
    case ProposalStatus.CANCELED:
      return "danger";
    case ProposalStatus.EXPIRED:
      return "muted";
    case ProposalStatus.DRAFT:
    default:
      return "info";
  }
}

function statusLabel(s: ProposalStatus): string {
  switch (s) {
    case ProposalStatus.ACCEPTED:
      return "Accepted";
    case ProposalStatus.SENT:
      return "Sent";
    case ProposalStatus.VIEWED:
      return "Viewed";
    case ProposalStatus.DECLINED:
      return "Declined";
    case ProposalStatus.CANCELED:
      return "Canceled";
    case ProposalStatus.EXPIRED:
      return "Expired";
    case ProposalStatus.DRAFT:
    default:
      return "Draft";
  }
}

export default async function ProposalListPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string }>;
}) {
  await requireAgency();

  const { filter: rawFilter, q: rawQ } = await searchParams;
  const filter = parseFilter(rawFilter);
  const q = (rawQ ?? "").trim();

  const baseWhere = whereForFilter(filter);
  const where: Prisma.ProposalWhereInput =
    q.length > 0
      ? {
          AND: [
            baseWhere,
            {
              OR: [
                { prospectEmail: { contains: q, mode: "insensitive" } },
                { prospectName: { contains: q, mode: "insensitive" } },
                { prospectCompany: { contains: q, mode: "insensitive" } },
                { number: { contains: q, mode: "insensitive" } },
              ],
            },
          ],
        }
      : baseWhere;

  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );

  const [proposals, openCount, awaitingCount, acceptedMtd, mrrAddedMtd] =
    await Promise.all([
      prisma.proposal.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 200,
        include: {
          createdBy: { select: { id: true, email: true } },
        },
      }),
      prisma.proposal.count({
        where: {
          status: {
            in: [
              ProposalStatus.DRAFT,
              ProposalStatus.SENT,
              ProposalStatus.VIEWED,
            ],
          },
        },
      }),
      prisma.proposal.count({
        where: { status: { in: [ProposalStatus.SENT, ProposalStatus.VIEWED] } },
      }),
      prisma.proposal.count({
        where: {
          status: ProposalStatus.ACCEPTED,
          acceptedAt: { gte: monthStart },
        },
      }),
      // MRR-MTD must reflect what we actually invoice, not the pre-discount
      // subtotal. A $1,000/mo line with a $500 first-month discount is $500
      // of recurring revenue, not $1,000. We pull the rows + apply the same
      // discount allocator the composer + Stripe builder use so the KPI is
      // consistent with downstream truth.
      prisma.proposal.findMany({
        where: {
          status: ProposalStatus.ACCEPTED,
          acceptedAt: { gte: monthStart },
        },
        select: {
          recurringSubtotalCents: true,
          oneTimeSubtotalCents: true,
          discountAmountCents: true,
          discountScope: true,
        },
      }),
    ]);

  // Compute post-discount MRR per accepted proposal, then sum. Uses the
  // same allocator as `lib/proposals/totals.ts` so the math agrees with
  // the proposal page totals + the Stripe Checkout build.
  const mrrAddedCents = mrrAddedMtd.reduce((acc, row) => {
    const scope =
      row.discountScope === "recurring" ||
      row.discountScope === "one_time" ||
      row.discountScope === "both"
        ? row.discountScope
        : "both";
    const allocation = allocateDiscountCentsShared({
      recurringSubtotal: row.recurringSubtotalCents,
      oneTimeSubtotal: row.oneTimeSubtotalCents,
      discountAmount: row.discountAmountCents,
      scope,
    });
    return acc + (row.recurringSubtotalCents - allocation.recurring);
  }, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Proposals"
        description="Build, send, track — every prospect quote in one queue."
        actions={
          <Link
            href="/admin/proposals/new"
            className="inline-flex items-center rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:bg-primary-dark transition-colors"
          >
            New proposal
          </Link>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total open" value={openCount} />
        <StatCard label="Awaiting accept" value={awaitingCount} />
        <StatCard label="Accepted MTD" value={acceptedMtd} />
        <StatCard label="MRR added MTD" value={formatCents(mrrAddedCents)} />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <nav className="flex flex-wrap gap-1.5" aria-label="Filter proposals">
          <FilterLink active={filter} value="open" q={q} label="Open" />
          <FilterLink active={filter} value="draft" q={q} label="Drafts" />
          <FilterLink active={filter} value="sent" q={q} label="Sent" />
          <FilterLink active={filter} value="accepted" q={q} label="Accepted" />
          <FilterLink active={filter} value="declined" q={q} label="Declined" />
          <FilterLink active={filter} value="expired" q={q} label="Expired" />
          <FilterLink active={filter} value="all" q={q} label="All" />
        </nav>
        <form className="flex-shrink-0">
          <input type="hidden" name="filter" value={filter} />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search prospect, email, number"
            className="w-full sm:w-72 rounded-md border border-border bg-card px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </form>
        <Link
          href="/admin/proposals/catalog"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Manage catalog →
        </Link>
      </div>

      {proposals.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No proposals match this filter.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                <th className="text-left px-4 py-2 font-medium">Number</th>
                <th className="text-left px-4 py-2 font-medium">Prospect</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="text-right px-4 py-2 font-medium">Recurring</th>
                <th className="text-right px-4 py-2 font-medium">One-time</th>
                <th className="text-left px-4 py-2 font-medium">Created</th>
                <th className="text-left px-4 py-2 font-medium">Sent</th>
                <th className="text-left px-4 py-2 font-medium">Viewed</th>
                <th className="text-left px-4 py-2 font-medium">By</th>
              </tr>
            </thead>
            <tbody>
              {proposals.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-border last:border-b-0 hover:bg-muted/20 transition-colors"
                >
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/admin/proposals/${p.id}`}
                      className="font-mono text-xs text-primary hover:underline"
                    >
                      {p.number}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 min-w-0">
                    <Link
                      href={`/admin/proposals/${p.id}`}
                      className="block min-w-0"
                    >
                      <div className="font-medium text-foreground truncate">
                        {p.prospectCompany || p.prospectName}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {p.prospectEmail}
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge tone={statusTone(p.status)}>
                      {statusLabel(p.status)}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {formatCents(p.recurringSubtotalCents)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {formatCents(p.oneTimeSubtotalCents)}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(p.createdAt, { addSuffix: true })}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                    {p.sentAt
                      ? formatDistanceToNow(p.sentAt, { addSuffix: true })
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                    {p.lastViewedAt
                      ? formatDistanceToNow(p.lastViewedAt, { addSuffix: true })
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground truncate max-w-[12rem]">
                    {p.createdBy?.email ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilterLink({
  active,
  value,
  q,
  label,
}: {
  active: FilterKey;
  value: FilterKey;
  q: string;
  label: string;
}) {
  const isActive = active === value;
  const search = new URLSearchParams();
  if (value !== "open") search.set("filter", value);
  if (q) search.set("q", q);
  const href = search.toString()
    ? `/admin/proposals?${search.toString()}`
    : "/admin/proposals";
  return (
    <Link
      href={href}
      className={cn(
        "px-2.5 py-1 rounded-md text-xs font-medium border transition-colors",
        isActive
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-card text-foreground border-border hover:bg-muted/50",
      )}
    >
      {label}
    </Link>
  );
}
