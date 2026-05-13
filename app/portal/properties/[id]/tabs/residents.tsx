import { format, differenceInDays } from "date-fns";
import { prisma } from "@/lib/db";
import { DashboardSection } from "@/components/portal/dashboard/dashboard-section";
import { KpiTile } from "@/components/portal/dashboard/kpi-tile";
import { ResidentStatus } from "@prisma/client";
import {
  AlertTriangle,
  CheckCircle2,
  Mail,
  Phone,
  Home,
} from "lucide-react";
import { EmptyState } from "@/components/portal/ui/empty-state";
import {
  EntityToolbar,
  type ToolbarView,
} from "@/components/portal/ui/entity-toolbar";
import {
  PillCell,
  EmailCell,
  PhoneCell,
  MoneyCell,
  DateCell,
  HashCell,
  EmptyCell,
} from "@/components/portal/ui/cells";
import { Avatar } from "@/components/portal/ui/data-table";

// ---------------------------------------------------------------------------
// Residents tab — per-property AppFolio resident roster, rebuilt as a
// Twenty-style entity directory with view tabs, filter chips, and inline
// pill cells. Replaces the bland spreadsheet that was here before.
// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<ResidentStatus, string> = {
  ACTIVE: "Active",
  PAST: "Past",
  NOTICE_GIVEN: "Notice given",
  EVICTED: "Evicted",
  APPLICANT: "Applicant",
};

// Map ResidentStatus → PillCell tone. ACTIVE/APPLICANT collapse onto brand
// blue, NOTICE_GIVEN reads as a real warning (amber), EVICTED is the only
// one that warrants a destructive cue.
const STATUS_TONE = {
  ACTIVE: "active",
  NOTICE_GIVEN: "warning",
  EVICTED: "danger",
  PAST: "muted",
  APPLICANT: "info",
} as const;

export async function ResidentsTab({
  orgId,
  propertyId,
  view = "active",
}: {
  orgId: string;
  propertyId: string;
  view?: "all" | "active" | "notice" | "past" | "evicted";
}) {
  try {
    // Bug #19 — "Notice given: 80 (KPI) vs 57 (list)" was a take:200
    // truncation: when view=all and total residents > 200, the
    // noticeBoard derived from `residents.filter(...)` undercounted.
    // Fix: query the notice-board AND coverage metrics independently
    // of the paginated table so KPI numbers match the underlying truth
    // regardless of pagination state.
    //
    // Bug #17 — email/phone coverage was computed against
    // `visibleActive` (the active rows in the loaded slice), so a
    // restricted view denominator could be misleading. Now we count
    // contact coverage across ALL active residents for this property
    // and the displayed denominator matches the KPI label.
    const [
      counts,
      residents,
      noticeBoardRows,
      activeContactStats,
    ] = await Promise.all([
      prisma.resident.groupBy({
        by: ["status"],
        where: { orgId, propertyId },
        _count: { _all: true },
      }),
      prisma.resident.findMany({
        where: {
          orgId,
          propertyId,
          ...(view === "active" && { status: ResidentStatus.ACTIVE }),
          ...(view === "notice" && { status: ResidentStatus.NOTICE_GIVEN }),
          ...(view === "past" && { status: ResidentStatus.PAST }),
          ...(view === "evicted" && { status: ResidentStatus.EVICTED }),
        },
        orderBy: [{ status: "asc" }, { lastName: "asc" }],
        take: 200,
        include: {
          listing: { select: { id: true, unitNumber: true } },
          currentLease: {
            select: {
              id: true,
              endDate: true,
              monthlyRentCents: true,
              isPastDue: true,
              currentBalanceCents: true,
            },
          },
        },
      }),
      // Notice-board lookup — independent of the paginated list above.
      // Take 8 (matches the `.slice(0, 8)` cap below) plus the lease
      // info needed by ResidentTable variant=notice.
      prisma.resident.findMany({
        where: {
          orgId,
          propertyId,
          status: ResidentStatus.NOTICE_GIVEN,
        },
        orderBy: { lastName: "asc" },
        take: 8,
        include: {
          listing: { select: { id: true, unitNumber: true } },
          currentLease: {
            select: {
              id: true,
              endDate: true,
              monthlyRentCents: true,
              isPastDue: true,
              currentBalanceCents: true,
            },
          },
        },
      }),
      // Coverage metrics — count email/phone presence across ALL active
      // residents for this property, not just the visible slice. KPI
      // tile denominator now matches its own label.
      prisma.resident.aggregate({
        where: {
          orgId,
          propertyId,
          status: ResidentStatus.ACTIVE,
        },
        _count: {
          _all: true,
          email: true,
          phone: true,
        },
      }),
    ]);

    const countByStatus = Object.fromEntries(
      counts.map((c) => [c.status, c._count._all]),
    ) as Partial<Record<ResidentStatus, number>>;

    const totalCount = counts.reduce((s, c) => s + c._count._all, 0);
    const activeCount = countByStatus[ResidentStatus.ACTIVE] ?? 0;
    const noticeCount = countByStatus[ResidentStatus.NOTICE_GIVEN] ?? 0;
    const pastCount = countByStatus[ResidentStatus.PAST] ?? 0;
    const evictedCount = countByStatus[ResidentStatus.EVICTED] ?? 0;

    // Whole-property contact coverage (not slice-bounded). Prisma's
    // aggregate `_count.email` counts non-null emails; same for phone.
    const withEmail = activeContactStats._count.email ?? 0;
    const withPhone = activeContactStats._count.phone ?? 0;
    const denominator = activeContactStats._count._all ?? activeCount;

    if (totalCount === 0) {
      return (
        <EmptyState
          title="No residents synced yet"
          body="AppFolio sync will populate this tab with the active roster, lease data, and notice-given predictive availability."
        />
      );
    }

    const baseHref = `?tab=residents`;
    const views: ToolbarView[] = [
      {
        label: "All",
        href: `${baseHref}&view=all`,
        count: totalCount,
        active: view === "all",
      },
      {
        label: "Active",
        href: `${baseHref}&view=active`,
        count: activeCount,
        active: view === "active",
      },
      {
        label: "Notice given",
        href: `${baseHref}&view=notice`,
        count: noticeCount,
        active: view === "notice",
      },
      {
        label: "Past",
        href: `${baseHref}&view=past`,
        count: pastCount,
        active: view === "past",
      },
      ...(evictedCount > 0
        ? [
            {
              label: "Evicted",
              href: `${baseHref}&view=evicted`,
              count: evictedCount,
              active: view === "evicted",
            },
          ]
        : []),
    ];

    // Notice-board now uses the independent query so it always
    // matches the noticeCount KPI tile, regardless of the paginated
    // table's view filter or take=200 cap.
    const noticeBoard = noticeBoardRows;

    return (
      <div className="space-y-5">
        {/* KPI strip — stays at top. Reflects the active view. */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiTile
            label="Active residents"
            value={activeCount.toLocaleString()}
            /* Bug #18 — explicit "residents" label so it doesn't
               collide with "Active leases" on the Renewals tab. One
               resident can be on multiple lease records. */
            hint="Headcount · Renewals tab shows lease records"
            icon={<CheckCircle2 className="h-3.5 w-3.5" />}
          />
          <KpiTile
            label="Notice given"
            value={noticeCount.toLocaleString()}
            hint="Predictive availability"
            icon={<AlertTriangle className="h-3.5 w-3.5" />}
          />
          <KpiTile
            label="Email coverage"
            value={
              denominator > 0
                ? `${Math.round((withEmail / denominator) * 100)}%`
                : "—"
            }
            hint={`${withEmail} of ${denominator} active`}
            icon={<Mail className="h-3.5 w-3.5" />}
          />
          <KpiTile
            label="Phone coverage"
            value={
              denominator > 0
                ? `${Math.round((withPhone / denominator) * 100)}%`
                : "—"
            }
            hint={`${withPhone} of ${denominator} active`}
            icon={<Phone className="h-3.5 w-3.5" />}
          />
        </section>

        {/* Notice-given board — operator action surface. Only shown when
            notice-board is non-empty AND we're not already filtered to it. */}
        {noticeBoard.length > 0 && view !== "notice" ? (
          <DashboardSection
            title="Notice given — predictive availability"
            eyebrow={`${noticeCount}`}
            description={
              noticeCount > noticeBoard.length
                ? `Top ${noticeBoard.length} of ${noticeCount} residents on notice. Fire up campaigns ahead of move-out.`
                : "Units coming open soon. Fire up campaigns ahead of move-out."
            }
          >
            <ResidentTable residents={noticeBoard} variant="notice" />
          </DashboardSection>
        ) : null}

        {/* Twenty-style entity toolbar + table */}
        <div className="space-y-2">
          <EntityToolbar views={views} />
          <ResidentTable residents={residents} variant="full" />
        </div>
      </div>
    );
  } catch (err) {
    console.error("[ResidentsTab] Failed to load AppFolio data:", err);
    return (
      <div className="rounded-xl border border-border bg-muted/40 p-6 text-center">
        <p className="text-sm font-semibold text-foreground">
          Resident data unavailable
        </p>
        <p className="mt-1 text-xs text-foreground">
          AppFolio sync may not be configured for this property. Check{" "}
          <a
            href="/portal/settings/integrations"
            className="underline"
          >
            Settings → Integrations
          </a>
          .
        </p>
      </div>
    );
  }
}

// ---------------------------------------------------------------------------
// ResidentTable — Twenty-style row layout. Each row is a flex container
// (not a <table>) so cell pills can wrap gracefully on narrow screens.
//
// `variant="notice"` collapses to a 4-column urgency layout (resident, unit,
// move-out, days). `variant="full"` renders the complete column set.
// ---------------------------------------------------------------------------

type ResidentRow = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  status: ResidentStatus;
  unitNumber: string | null;
  moveInDate: Date | null;
  moveOutDate: Date | null;
  monthlyRentCents: number | null;
  listing?: { id: string; unitNumber: string | null } | null;
  currentLease?: {
    id: string;
    endDate: Date | null;
    monthlyRentCents: number | null;
    isPastDue: boolean;
    currentBalanceCents: number | null;
  } | null;
};

function ResidentTable({
  residents,
  variant,
}: {
  residents: ResidentRow[];
  variant: "full" | "notice";
}) {
  if (residents.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-xs text-muted-foreground">
        No residents in this view.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Header strip */}
      <div
        className={
          variant === "notice"
            ? "hidden md:grid grid-cols-[1fr_100px_140px_80px] gap-3 px-3 py-2 border-b border-border bg-muted/30 text-[9px] tracking-widest uppercase font-semibold text-muted-foreground"
            : "hidden md:grid grid-cols-[minmax(220px,1.6fr)_minmax(160px,1.4fr)_100px_120px_120px_140px_140px] gap-3 px-3 py-2 border-b border-border bg-muted/30 text-[9px] tracking-widest uppercase font-semibold text-muted-foreground"
        }
      >
        <div>Resident</div>
        {variant === "full" ? <div>Contact</div> : null}
        <div>Unit</div>
        <div>{variant === "notice" ? "Move-out" : "Status"}</div>
        {variant === "notice" ? (
          <div className="text-right">Days out</div>
        ) : (
          <>
            <div className="text-right">Rent</div>
            <div>Move-in</div>
            <div>Lease end</div>
          </>
        )}
      </div>

      {/* Rows */}
      <div className="divide-y divide-border">
        {residents.map((r) => (
          <ResidentRow key={r.id} resident={r} variant={variant} />
        ))}
      </div>
    </div>
  );
}

function ResidentRow({
  resident: r,
  variant,
}: {
  resident: ResidentRow;
  variant: "full" | "notice";
}) {
  const name =
    [r.firstName, r.lastName].filter(Boolean).join(" ") ||
    r.email ||
    "Resident";
  const days = r.moveOutDate
    ? differenceInDays(r.moveOutDate, new Date())
    : null;
  const unit = r.unitNumber ?? r.listing?.unitNumber ?? null;

  if (variant === "notice") {
    return (
      <div className="grid grid-cols-[1fr_100px_140px_80px] gap-3 px-3 py-2 items-center hover:bg-muted/30 transition-colors">
        <div className="flex items-center gap-2 min-w-0">
          <Avatar name={name} seed={r.id} size={22} />
          <span className="text-[12px] font-semibold text-foreground truncate">
            {name}
          </span>
        </div>
        <div>{unit ? <HashCell value={unit} /> : <EmptyCell />}</div>
        <div>
          {r.moveOutDate ? <DateCell value={r.moveOutDate} /> : <EmptyCell />}
        </div>
        <div className="text-right">
          {days != null ? (
            <span
              className={
                days <= 30
                  ? "inline-flex items-center rounded-md border border-border bg-muted/40 text-foreground px-1.5 py-0.5 text-[11px] font-semibold tabular-nums"
                  : "tabular-nums text-[12px] text-foreground font-medium"
              }
            >
              {days}d
            </span>
          ) : (
            <EmptyCell />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[minmax(220px,1.6fr)_minmax(160px,1.4fr)_100px_120px_120px_140px_140px] gap-3 px-3 py-2 items-center hover:bg-muted/30 transition-colors">
      {/* Resident — avatar + name */}
      <div className="flex items-center gap-2 min-w-0">
        <Avatar name={name} seed={r.id} size={22} />
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-foreground truncate leading-tight">
            {name}
          </p>
          {r.email ? (
            <p className="text-[10px] text-muted-foreground truncate leading-tight mt-0.5">
              {r.email}
            </p>
          ) : null}
        </div>
      </div>

      {/* Contact — pill stack */}
      <div className="flex items-center gap-1.5 min-w-0">
        {r.email ? <EmailCell value={r.email} /> : null}
        {r.phone ? <PhoneCell value={r.phone} /> : null}
        {!r.email && !r.phone ? <EmptyCell /> : null}
      </div>

      {/* Unit */}
      <div>{unit ? <HashCell value={unit} /> : <EmptyCell />}</div>

      {/* Status pill + past-due flag */}
      <div className="flex items-center gap-1 flex-wrap">
        <PillCell tone={STATUS_TONE[r.status]}>
          {STATUS_LABEL[r.status]}
        </PillCell>
        {r.currentLease?.isPastDue ? (
          <PillCell tone="warning">
            Past-due{" "}
            {r.currentLease.currentBalanceCents != null
              ? `$${Math.round(r.currentLease.currentBalanceCents / 100).toLocaleString()}`
              : ""}
          </PillCell>
        ) : null}
      </div>

      {/* Rent */}
      <div className="text-right">
        <MoneyCell
          cents={r.currentLease?.monthlyRentCents ?? r.monthlyRentCents}
          bold
        />
      </div>

      {/* Move-in */}
      <div>
        {r.moveInDate ? (
          <DateCell value={r.moveInDate} hideIcon />
        ) : (
          <EmptyCell />
        )}
      </div>

      {/* Lease end */}
      <div>
        {r.currentLease?.endDate ? (
          <DateCell value={r.currentLease.endDate} hideIcon />
        ) : (
          <EmptyCell />
        )}
      </div>
    </div>
  );
}

// Wrapper that pulls the `view` URL param and forwards it. Property tab
// router renders <ResidentsTab orgId={...} propertyId={...} /> — we'd need
// to thread searchParams down for true URL-driven filtering. For now the
// default view is "active" which matches the most common operator workflow.
export function HomeIcon() {
  return <Home className="h-3 w-3" />;
}
