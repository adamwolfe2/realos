# UI declutter playbook

Three patterns landed across enough surfaces in the 2026-06-04 portal audit (16 commits, see `.claude/audits/2026-06-03-portal/REPORT.md`) that they're worth codifying so future passes apply the same shapes without re-deriving them.

The rule of thumb behind all three: **the page is for the operator, not the schema.** If a row of pills, tiles, or status chips mostly shows zeros, the page is telling the operator about the absence of states the schema models — not about the work the operator needs to do. Hide the absence, surface the presence.

---

## 1. Hide-zero-count chip / tab / tile

When a filter row iterates every enum value, a tenant with a narrow state space sees a wall of zero pills competing with the one that matters.

### Shape

```tsx
// Server: get counts once per page render.
const statusCounts = await prisma.organization.groupBy({
  by: ["status"],
  where: { orgType: OrgType.CLIENT },
  _count: { _all: true },
});
const statusCountMap = new Map<TenantStatus, number>(
  statusCounts.map((r) => [r.status as TenantStatus, r._count._all]),
);

// Render: All + statuses with count > 0 + the currently-active filter
// (so the operator can always click off whatever they've selected,
//  even if its count just dropped to zero).
<nav>
  <StatusLink current={status} value="" label="All" />
  {Object.values(TenantStatus)
    .filter((s) => (statusCountMap.get(s) ?? 0) > 0 || status === s)
    .map((s) => (
      <StatusLink key={s} current={status} value={s} label={humanTenantStatus(s)} />
    ))}
</nav>
```

### When to apply

- Filter chip rows that iterate an enum (status, severity, action type, source).
- KPI tile rows where many tiles represent narrow states (Open vs Pending vs In progress vs ...).
- Tab bars (`<TabGroup>`-style) where some tabs are almost always empty.

### When NOT to apply

- Three-tab workflow buckets (e.g. `/admin/intakes` has Open / Converted / All). Hiding loses the shape of the workflow.
- The full pipeline view (e.g. `/admin/site-engine` when there's real work — operators expect to see every status they could move a card into). Apply hide-zero on the empty-queue case only.

### Surfaces this has shipped to

`/portal/conversations` · `/admin/clients` · `/admin/site-engine` · `/admin/audit-log` · `/admin/bug-reports` · `/admin` (agency Operations panel)

---

## 2. Empty-state collapse

When every KPI on a strip is zero AND the page has nothing else to render, the strip + sub-sections read as broken product. Swap the whole stack for one focused `<EmptyState>` card explaining what's coming.

### Shape

```tsx
{activeCount + expiringCount + pastDueCount === 0 &&
(rentRollTotal._sum.monthlyRentCents ?? 0) === 0 ? (
  <EmptyState
    title="No lease data yet"
    body="Renewal KPIs populate as soon as AppFolio syncs your first
    active lease."
    action={{ label: "Manage integrations", href: "/portal/settings/integrations" }}
  />
) : (
  <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
    <KpiTile label="Active leases" value={activeCount.toLocaleString()} ... />
    ...
  </section>
)}
```

The `<EmptyState>` primitive lives at `components/portal/ui/empty-state.tsx`. Use it — don't hand-roll dashed-border divs.

### When to apply

- A page whose primary content is one KPI strip + one table, both empty.
- A page whose primary content is N sub-sections (mention feed, top movers, lead heatmap, recommendations), and all N are empty.

### Variant: per-section collapse

If only some sub-sections are empty (e.g. `latest` exists but `mentionRows` is empty), don't collapse the whole page — each section component handles its own empty state inline. The full-page collapse is only for the brand-new-tenant first-load case.

### Surfaces this has shipped to

`/portal/renewals` · `/portal/residents` · `/portal/work-orders` · `/portal/insights` · `/admin/site-engine`

---

## 3. Link strip instead of secondary tile row

When a page has primary KPIs + secondary cross-product metrics, render the secondary set as one inline link row instead of a 4-up tile grid. Same data, far less visual weight.

### Shape

```tsx
{(kpiVisitors28d || kpiChatbot28d || kpiPopupConv28d || kpiApplications28d) > 0 ? (
  <p
    aria-label="Cross-product signals (28d)"
    className="flex items-center gap-x-4 gap-y-1 flex-wrap text-[12px] text-muted-foreground"
  >
    <span className="text-[10px] uppercase tracking-[0.14em] font-semibold text-foreground/60">
      Also touched · 28d
    </span>
    {kpiVisitors28d > 0 ? (
      <Link href="/portal/visitors" className="inline-flex items-center gap-1 hover:text-foreground">
        <Eye className="h-3 w-3" aria-hidden="true" />
        <span className="font-semibold tabular-nums text-foreground">
          {kpiVisitors28d.toLocaleString()}
        </span>{" "}
        tracked visitors
      </Link>
    ) : null}
    {/* … */}
  </p>
) : null}
```

### When to apply

When a page already has a 4-tile primary KPI row, and a designer is tempted to add a second 4-tile row for cross-product signals.

### Shipped on

`/portal/leads` (replaced "Tracked visitors / Chatbot convos / Popup conversions / Applications" tile row with the inline link strip).

---

## How to know you're done

1. **Five-second test.** Land on the page cold. What does an operator look at first? If the answer is anything other than "the numbers that explain how the business is doing today," the page needs cuts.
2. **Empty-tenant simulation.** Render the page for a brand-new tenant with no integrations connected and no data flowing. If the page looks broken (wall of zeros, multiple empty cards stacked), apply pattern #1 or #2.
3. **Visual weight test.** Count how many distinct rectangles compete for attention above the fold. If it's >6, something is over-rendering.

---

## Companion: the audit harness

`scripts/portal-audit/` (committed) — Playwright-driven capture pipeline:

- `login.mjs` — one-time headed Clerk sign-in into a persistent profile
- `capture.mjs` — bulk operator-route capture (51 routes)
- `capture-as-tenant.mjs` — impersonate a CLIENT org then bulk-capture (needed when running as a super-admin whose direct view is the agency surface)
- `capture-admin.mjs` — bulk-capture `/admin/*` routes
- `capture-marketing.mjs` — bulk-capture public marketing routes
- `capture-one.mjs` / `capture-one-as-tenant.mjs` — single-route fast iteration after a fix
- `diagnose-signin.mjs` — Clerk DOM + CSP + network forensic for sign-in renders

Use it for the next pass.
