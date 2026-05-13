import type { Metadata } from "next";
import Link from "next/link";
import { requireAgency } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { PixelRequestStatus } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import type { BadgeTone } from "@/lib/format";
import { CancelPixelRequestButton } from "./cancel-button";

export const metadata: Metadata = { title: "Pixel requests" };
export const dynamic = "force-dynamic";

function statusLabel(s: PixelRequestStatus): string {
  switch (s) {
    case PixelRequestStatus.PENDING:
      return "Pending";
    case PixelRequestStatus.FULFILLED:
      return "Fulfilled";
    case PixelRequestStatus.CANCELLED:
      return "Cancelled";
  }
}

function statusTone(s: PixelRequestStatus): BadgeTone {
  switch (s) {
    case PixelRequestStatus.PENDING:
      return "warning";
    case PixelRequestStatus.FULFILLED:
      return "success";
    case PixelRequestStatus.CANCELLED:
      return "muted";
  }
}

export default async function PixelRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  await requireAgency();
  const { filter = "open" } = await searchParams;

  const statusFilter =
    filter === "all"
      ? undefined
      : filter === "fulfilled"
        ? PixelRequestStatus.FULFILLED
        : filter === "cancelled"
          ? PixelRequestStatus.CANCELLED
          : PixelRequestStatus.PENDING;

  const [requests, counts] = await Promise.all([
    prisma.pixelProvisionRequest.findMany({
      where: statusFilter ? { status: statusFilter } : undefined,
      orderBy: [{ status: "asc" }, { requestedAt: "desc" }],
      select: {
        id: true,
        status: true,
        websiteName: true,
        websiteUrl: true,
        requestedAt: true,
        fulfilledAt: true,
        fulfilledPixelId: true,
        org: {
          select: { id: true, name: true, slug: true },
        },
        requestedByUserId: true,
      },
    }),
    prisma.pixelProvisionRequest.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);

  const requesterIds = Array.from(
    new Set(
      requests
        .map((r) => r.requestedByUserId)
        .filter((id): id is string => Boolean(id))
    )
  );
  const requesters = requesterIds.length
    ? await prisma.user.findMany({
        where: { id: { in: requesterIds } },
        select: { id: true, email: true, firstName: true, lastName: true },
      })
    : [];
  const requesterById = new Map(
    requesters.map((u) => [
      u.id,
      {
        ...u,
        displayName:
          [u.firstName, u.lastName].filter(Boolean).join(" ").trim() ||
          u.email,
      },
    ])
  );

  const countByStatus = new Map(
    counts.map((c) => [c.status, c._count._all])
  );
  const pendingCount = countByStatus.get(PixelRequestStatus.PENDING) ?? 0;
  const fulfilledCount = countByStatus.get(PixelRequestStatus.FULFILLED) ?? 0;
  const cancelledCount = countByStatus.get(PixelRequestStatus.CANCELLED) ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pixel requests"
        description="Customers waiting on a Cursive (AudienceLab) pixel. AL has no creation API, so each one is a 3-5 minute setup in the AL dashboard. Pasting the resulting pixel_id into the client's admin Cursive panel auto-fulfills the request and emails the customer their install snippet."
      />

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <FilterTab href="?filter=open" active={filter === "open"} label="Pending" count={pendingCount} />
        <FilterTab href="?filter=fulfilled" active={filter === "fulfilled"} label="Fulfilled" count={fulfilledCount} />
        <FilterTab href="?filter=cancelled" active={filter === "cancelled"} label="Cancelled" count={cancelledCount} />
        <FilterTab href="?filter=all" active={filter === "all"} label="All" count={pendingCount + fulfilledCount + cancelledCount} />
      </div>

      <div className="border border-border bg-card rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <Th>Client</Th>
                <Th>Website</Th>
                <Th>Requested</Th>
                <Th>Requester</Th>
                <Th>Status</Th>
                <Th className="text-right">Action</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {requests.map((r) => {
                const requester = r.requestedByUserId
                  ? requesterById.get(r.requestedByUserId)
                  : null;
                return (
                  <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/clients/${r.org.id}`}
                        className="font-medium text-foreground hover:text-primary transition-colors"
                      >
                        {r.org.name}
                      </Link>
                      <div className="text-[11px] text-muted-foreground">{r.org.slug}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-[13px] text-foreground">{r.websiteName}</div>
                      <a
                        href={r.websiteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 break-all"
                      >
                        {r.websiteUrl}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(r.requestedAt, { addSuffix: true })}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {requester ? (
                        <>
                          <div className="text-foreground">{requester.displayName}</div>
                          {requester.displayName !== requester.email && (
                            <div className="text-[11px]">{requester.email}</div>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <StatusBadge tone={statusTone(r.status)}>
                          {statusLabel(r.status)}
                        </StatusBadge>
                        {r.fulfilledAt && (
                          <div className="text-[11px] text-muted-foreground">
                            {formatDistanceToNow(r.fulfilledAt, { addSuffix: true })}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.status === PixelRequestStatus.PENDING ? (
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/clients/${r.org.id}#cursive-panel`}
                            className="text-xs text-foreground bg-primary text-primary-foreground rounded-md px-3 py-1.5 hover:bg-primary/90 transition-colors"
                            style={{ borderRadius: 6 }}
                          >
                            Fulfill in AL →
                          </Link>
                          <CancelPixelRequestButton requestId={r.id} />
                        </div>
                      ) : r.fulfilledPixelId ? (
                        <code className="text-[11px] font-mono text-muted-foreground">
                          {r.fulfilledPixelId.slice(0, 12)}…
                        </code>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
              {requests.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    {filter === "open"
                      ? "No pending pixel requests. Customers will show up here when they hit the Connect Cursive pixel button on their portal."
                      : "Nothing to show for this filter."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function FilterTab({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-primary text-primary-foreground hover:bg-primary-dark transition-colors"
          : "inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-border hover:bg-muted/40 transition-colors"
      }
      style={{ borderRadius: 6 }}
    >
      <span>{label}</span>
      <span
        className={
          active
            ? "tabular-nums opacity-80"
            : "tabular-nums text-muted-foreground"
        }
      >
        {count}
      </span>
    </Link>
  );
}

function Th({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`text-left px-4 py-2.5 text-[11px] font-medium text-muted-foreground ${className ?? ""}`}
    >
      {children}
    </th>
  );
}
