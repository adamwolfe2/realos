# LeaseStack Correctness-First Takeover Thin Slice Plan

Status: READY
Last updated: 2026-08-04
Owner: Codex
Design source: `.claude/specs/2026-08-04-leasestack-correctness-takeover-design.md`

## Working Brief

- Feature or fix: Make property-dimensioned analytics trustworthy and
  structurally scoped, repair AppFolio activation backfills, then bring every
  portal route up to the visual standard of the marketing site and dashboard.
- Primary actors: LeaseStack operators, property-restricted users, agency
  operators, scheduled jobs, and the AppFolio sync worker.
- Core invariant: Customer-visible analytics, counts, charts, emails, AI
  insights, badges, and lists include only ACTIVE LeaseStack properties the
  viewer may access; nullable organization-level rows appear only when the
  surface explicitly supports them.
- Previous intended behaviours: Tenant and per-user property isolation remain
  intact; Cursive organization-level rows remain available where intended;
  curation retains IMPORTED/EXCLUDED Property rows; integration diagnostics may
  show raw inventory; LeaseStack tracks leasing intelligence rather than
  managing properties.
- Unsafe outcomes: Cross-tenant or cross-property disclosure; empty scopes
  widening to the organization; two `OR` clauses clobbering each other; billing
  changes without approval; an ACTIVE property without a durable backfill;
  premature backfill completion; destructive legacy cleanup; deploying schema-
  dependent code before its migration.
- Current evidence: Claude handoffs dated 2026-08-04/05; design artifact above;
  `lib/tenancy/property-filter.ts`; `lib/properties/marketable.ts`;
  `lib/insights/queries.ts`; `lib/integrations/appfolio-sync.ts`;
  `lib/integrations/appfolio-backfill.ts`; activation routes/actions; Prisma
  schema and pending migration; current four unpushed commits.
- Assumptions: ACTIVE remains the sole marketable lifecycle; the existing
  marketing website and main dashboard are approved visual references;
  organization-level rows are included only through an explicit scope mode;
  legacy child rows remain stored during this program.
- Out of scope: Replacing Prisma/Neon; denormalizing lifecycle onto children;
  deleting Property rows; turning LeaseStack into property management;
  rebranding the marketing website/dashboard; production migration, cleanup,
  billing, push, or deploy without explicit approval.

## Risk Classification

- Overall tier: Tier 1 program, decomposed into Tier 1/2/3 slices.
- Why: Customer-visible records, billing quantity, lifecycle state transitions,
  production migrations, background sync, and potentially destructive cleanup.
- Live-data risk: `.env.local` is production. No local command may initialize
  Prisma or execute app scripts unless the slice explicitly authorizes a
  read-only production check.
- Migration risk: One additive migration is already written but unapplied;
  later durable-backfill work needs a second handwritten migration.
- External-contract risk: AppFolio report windows, partial failures, retries,
  and Vercel's five-minute cron limit.

## Dependency Graph

| Node | Depends on | Parallel? | Shared-state risk | Notes |
| --- | --- | --- | --- | --- |
| S0 | None | No | branch/migration ordering | Read-only release baseline |
| S1 | S0 | No | shared scope contract | Fail-closed scope type + builders |
| S2 | S1 | No | Insights contract | First vertical customer slice |
| S3 | S2 | No | Prisma client/lint config | Runtime + static backstops |
| S4 | S3 | No | shared portal query modules | Briefing only |
| S5 | S4 | No | attribution contracts | Attribution + reverse attribution |
| S6 | S5 | No | report aggregation | Funnel + lead journey |
| S7 | S6 | No | portal layout/query surfaces | Nav, chatbot, creative, referrals, SEO |
| S8 | S7 | No | cron/email behavior | Insight + pixel email parity |
| S9 | S8 | No | admin aggregates | Admin truth + raw labels |
| S10 | S9 | No | Prisma schema | Durable backfill schema; migration not applied |
| S11 | S10 | No | lifecycle writes | Transactional promotion service |
| S12 | S11 | No | sync worker | Phase-aware backfill completion/retry |
| S13 | S12 | No | production data tooling | Reversible Insight cleanup; dry run only |
| S14 | S9 | No | billing/Stripe | Blocked on approved billable definition |
| S15 | S9, S12 | No | broad UI surface | UI truth audit against references |
| S16 | S15 | No | shared design components | Route-family convergence |
| S17 | S13-S16 | No | release/migrations | Full verification and controlled ship |

No implementation nodes are parallelized in this checkout. Shared scope
contracts, Prisma schema, generated client, and the known concurrent-session
branch hazard make a dedicated worktree plus single-threaded critical path safer.

## Audit Triage

Source artifacts:

- `.claude/specs/2026-08-05-next-session-handoff.md`
- `.claude/specs/2026-08-04-integration-scope-containment.md`
- `.claude/specs/2026-08-04-leasestack-correctness-takeover-design.md`

Findings reviewed: 15 groups

| Finding | Verified? | Disposition | Reason |
| --- | --- | --- | --- |
| Nullable scope widens Insights | Yes, current source | S1-S2 | Customer rows/counts/email |
| Briefing null idiom | Yes | S4 | Customer metrics |
| Attribution/reverse null idiom | Yes | S5 | Customer charts + relation count |
| Funnel/journey null idiom | Yes | S6 | Customer report |
| Portal nav counts | Yes | S7 | Customer-visible visibility |
| Chatbot/creative/referral/SEO counts | Yes | S7 | Additional audit findings |
| Daily Insight email | Yes | S8 | Customer email |
| Pixel digest duplicate/property scope | Yes | S8 | 1:many integration mismatch |
| Admin raw counts and velocity | Yes | S9 | Operator truth |
| Raw AppFolio diagnostic inventory | Yes | Preserve + relabel | Intentional exception |
| Activation arming is non-transactional | Yes | S11 | Confirmed state hazard |
| Wizard activation omissions | Yes | S11 | Two verified entry points |
| 30-day activation recovery | Yes | S12 | Conflicts with 180-day recovery rule |
| Any-phase request retirement | Yes | S12 | Work orders can be permanently skipped |
| Legacy child purge | Misframed | Dropped | Keep inert rows; only Insights need disposition |

## Progress

| Slice | Status | Tier | Owner | Evidence | Next gate |
| --- | --- | --- | --- | --- | --- |
| S0 | done | T2 | Codex | `main` ahead 4; four commit stats reviewed; additive SQL at migration line 20; generated declaration contains field at line 57452; diff check clean | start S1 with safe-feature-slice |
| S1 | done | T1 | Codex | 12 focused tests; ESLint + full tsc clean; empty-scope and OR-clobber mutations failed | start S2 |
| S2 | done | T1 | Codex | 17 focused tests; mutation failed; lint + tsc + compile clean | start S3; browser deferred to fixture runtime |
| S3 | done | T1 | Codex | 13 enforcement tests; full lint errors + tsc clean | start S4 |
| S4 | done | T1 | Codex | 21 Briefing/scope tests; 40 foundation tests; lint + tsc clean | start S5; browser deferred to fixture runtime |
| S5 | done | T1 | Codex | 18 attribution tests; 58 foundation tests; relation counts removed | start S6; browser deferred to S7 |
| S6 | done | T1 | Codex | 10 funnel tests; 68 combined tests; null contracts removed | start S7; browser deferred to S7 |
| S7 | done | T1 | Codex | 6 portal parity tests; 74 combined tests; lint + tsc clean | start S8; preview QA deferred to release gate |
| S8 | done | T1 | Codex | 9 digest job/scope/isolation tests; lint + tsc clean | start S9 |
| S9 | done | T2 | Codex | 94 admin/scope tests; lint + tsc clean | start S10 |
| S10 | done | T2 | Codex | schema valid; 5 migration contract tests | start S11; migration remains unapplied |
| S11 | done | T1 | Codex | 52 activation/guard tests; lint + tsc clean | start S12 after migration ordering |
| S12 | done | T2 | Codex | 39 backfill/phase/status tests; lint + tsc clean | start S13 |
| S13 | done | T1 | Codex | 10 manifest/apply/restore tests; lint + tsc clean | dry-run only; no production query |
| S14 | blocked | T1 | Codex | none | approve billable definition after preview |
| S15 | done | T3 | Codex | `docs/audits/2026-08-04-ui-truth-audit.md` | none |
| S16 | in_progress | T3 | Codex | S16A systemic interaction hardening | visual comparison evidence |
| S17 | blocked | T1 | Codex | none | migration/data/release approvals |

## Slices

### S0 - Establish a safe release baseline

Status: done
Tier: T2
Type: verification
Actor/trigger: Codex before editing deployable code.
Action: Audit the four local commits, current branch, pending migration, generated
client drift, and relevant tests without connecting to the database.
Invariant protected: No code that selects an absent column is deployed.
Intentional behaviour changes: None.
Previous intended behaviours preserved: All four existing commits remain intact.
Unsafe outcomes: Applying a migration, initializing Prisma against production,
changing branch in the shared checkout, or treating old green checks as current.
Dependencies: None.
Expected files: Read-only Git diff, schema, migration, handoff, test files.
Write boundaries: Only this plan's progress/evidence fields.
Tests required: None; inspect existing evidence and test definitions.
Runtime verification: None; production-backed runtime is out of scope.
Migration/backfill notes: Record unapplied migration ordering only.
External docs needed: None.
Acceptance criteria: Exact local commit diff and deploy-order hazard documented;
clean/dirty state and branch rechecked; no production connection made.
Exit evidence: 2026-08-04 — `main...origin/main [ahead 4]`; commits
`f94308d4`, `f876b020`, `32e4e91a`, and `516f32c7` reviewed by file/stat;
`prisma/migrations/20260804_add_appfolio_backfill_requested_at/migration.sql:20`
is additive/nullable; `prisma/schema.prisma:2212` selects the new field;
generated declaration contains it at `node_modules/.prisma/client/index.d.ts:57452`;
`git diff --check origin/main..HEAD` returned clean; no Prisma/database command ran.
Parallelization: Single-threaded.
Blocked on: Nothing.

### S1 - Introduce a fail-closed property data scope

Status: done
Tier: T1
Type: backend
Actor/trigger: Server analytics caller resolving tenant/user/selection scope.
Action: Add the discriminated `PropertyDataScope` contract, trusted resolver,
and required/nullable model clause builders; no existing surface migrates yet.
Invariant protected: Empty/no selection cannot become an implicit org-wide read.
Intentional behaviour changes: New analytics APIs require explicit scope.
Previous intended behaviours preserved: URL beats cookie; user access intersects
selection; org-level rows remain representable explicitly.
Unsafe outcomes: `[] -> {}`, raw URL IDs entering a builder, two top-level `OR`s,
or raw-integration scope without a reason.
Dependencies: S0.
Expected files: `lib/tenancy/property-data-scope.ts`, focused tests; minimal export
changes only.
Write boundaries: New scope module and its tests.
Tests required: RED tests for no ACTIVE properties, denied/mixed selection,
selected IDs, nullable rows, OR composition, and explicit raw scope.
Runtime verification: Not required; pure contract.
Migration/backfill notes: None.
External docs needed: None.
Acceptance criteria: No nullable/optional normal scope; empty IDs match nothing;
clause shapes are mutation-proven.
Exit evidence: 2026-08-04 — `property-data-scope.test.ts` 12/12; ESLint on
new source/test clean; full `tsc --noEmit` clean. Mutation 1 changed empty scope
to `{}` and failed the fail-closed test. Mutation 2 spread two `OR` clauses and
failed the AND-wrap test. No runtime/database access.
Parallelization: Single-threaded shared contract.
Blocked on: Nothing.

### S2 - Migrate Insights end to end

Status: done
Tier: T1
Type: backend
Actor/trigger: Portal/dashboard/cron requesting Insight rows or counts.
Action: Require `PropertyDataScope` in all Insight query helpers and callers.
Invariant protected: Insight rows and grouped counts use identical ACTIVE scope.
Intentional behaviour changes: Unrestricted operators see ACTIVE portfolio plus
explicitly included org-level insights, not every synced property.
Previous intended behaviours preserved: Severity ranking, rent-roll-kind hiding,
snooze/status behavior, per-property detail, and limits.
Unsafe outcomes: Daily email differs from portal; access-denied selection widens;
org-level row policy differs between rows and counts.
Dependencies: S1.
Expected files: `lib/insights/queries.ts`, portal Insights/dashboard callers,
daily digest route, tests.
Write boundaries: Insights query/call surfaces only.
Tests required: Characterization then RED scope tests; email/portal parity;
mutation deleting the gate and mutation converting empty IDs to `{}`.
Runtime verification: Browser-check Insights/dashboard with fixtures or mocks;
no production DB.
Migration/backfill notes: None.
External docs needed: None.
Acceptance criteria: Normal Insight query cannot express unscoped org read.
Exit evidence: 2026-08-04 — every Insight helper requires
`PropertyDataScope`; dashboard, Insights, Briefing, property detail, and daily
digest callers resolve explicit ACTIVE/allowed/selected scope. Scope + Insight
suites pass 17/17; focused ESLint, full `tsc --noEmit`, and `git diff --check`
are clean. Replacing the `getOpenInsights` scope with a raw bypass made 4/5
Insight tests fail; restoring it returned 17/17 green. Next.js compiled and
completed TypeScript; page-data collection stopped only because this isolated
worktree intentionally has no `DATABASE_URL`. Browser fixture verification is
deferred rather than connecting the local app to production.
Parallelization: Single-threaded.
Blocked on: Nothing.

### S3 - Add runtime and static scope backstops

Status: done
Tier: T1
Type: backend/tooling
Actor/trigger: A developer introduces a property-dimensioned analytics query.
Action: Add rejection-only Prisma query extension/context and AST enforcement
for aggregate operations, relation `_count`, raw SQL, and direct bypasses.
Invariant protected: New unscoped analytics fail locally/CI instead of returning
a plausible wrong number.
Intentional behaviour changes: Disallowed query shapes fail fast.
Previous intended behaviours preserved: Integration workers, authorized entity
reads, migrations/seeds, and named raw diagnostic repositories retain access.
Unsafe outcomes: Automatic query rewriting; sync worker rejection; false safety
claim for nested counts/raw SQL; bypass by comments or key order.
Dependencies: S2 proves the contract on one vertical.
Expected files: `lib/db/index.ts`, scope execution context, ESLint/custom AST test
or equivalent, enforcement tests.
Write boundaries: DB construction and enforcement only.
Tests required: Each allowed and rejected class; transaction behavior; relation
count/raw SQL fixtures; mutation/bypass cases.
Runtime verification: Build plus focused integration-free client mocks.
Migration/backfill notes: None.
External docs needed: Recheck Prisma 7.4 query-extension behavior via Context7.
Acceptance criteria: Backstop catches top-level omissions; static check covers
known extension blind spots; sync/maintenance exceptions are explicit.
Exit evidence: 2026-08-04 — Prisma 7.4.2 source/docs confirmed extensions
intercept top-level model operations but not nested relations, and preserve an
already-extended client through transaction callbacks. Added an AsyncLocalStorage
capability plus rejection-only `$allModels.$allOperations` extension for direct
property-dimensioned analytics reads. Added AST ESLint rules that reject new
direct Insight analytics, raw SQL outside explicit/audited boundaries, relation
`_count` in migrated repositories, and dropping the runtime wrapper. Runtime
and AST suites pass 13/13 (30/30 with scope/Insights); async concurrency proves
context isolation. Full TypeScript, full ESLint error-only, and diff checks pass.
Parallelization: Single-threaded shared Prisma client.
Blocked on: Nothing.

### S4 - Make Briefing scope explicit

Status: done
Tier: T1
Type: backend/frontend
Actor/trigger: Operator opens Briefing.
Action: Replace `null` filters in Briefing metrics, delta, conversations, and
recent Insights with `PropertyDataScope`.
Invariant protected: Default Briefing equals ACTIVE accessible portfolio.
Intentional behaviour changes: Imported/excluded activity disappears.
Previous intended behaviours preserved: Last-viewed windows, call-priority order,
org-level conversations when explicitly included.
Unsafe outcomes: Empty/denied scope widens or comparison windows use different
property cohorts.
Dependencies: S3.
Expected files: briefing page/queries and tests.
Write boundaries: Briefing only.
Tests required: Current/prior cohort parity and original null mutation.
Runtime verification: Desktop/mobile Briefing browser QA.
Migration/backfill notes: None.
External docs needed: None.
Acceptance criteria: Every Briefing number consumes one resolved scope.
Exit evidence: 2026-08-04 — every Briefing helper now requires one resolved
`PropertyDataScope`; current/prior metrics, since-last-viewed counts, call
priorities, transcripts, aging, SEO, tours, applications, chats, and recent
Insights share the ACTIVE/access-controlled cohort. Required-property models
exclude impossible org-level rows; nullable models include them only by explicit
policy. Briefing/scope suites pass 21/21 and the combined foundation passes
40/40; full ESLint error-only, full TypeScript, and diff checks pass. The
pre-change empty-scope test failed by widening to no property filter, then passed
with the fail-closed sentinel. AST enforcement now covers the Briefing repository.
Browser verification remains grouped into S7's fixture/deployment QA gate.
Parallelization: Single-threaded.
Blocked on: Nothing.

### S5 - Make Attribution scope explicit

Status: done
Tier: T1
Type: backend/frontend
Actor/trigger: Operator opens attribution or reverse-attribution.
Action: Replace nullable filters, including visitor-session relations and
`Visitor._count.leads`, with explicit scoped repository queries.
Invariant protected: Sessions, visitors, leads, and outcomes share one scope.
Intentional behaviour changes: Default excludes non-ACTIVE property records.
Previous intended behaviours preserved: Explicit org-level pixel rows, date
range, source classification, and GA4 supplemental reach.
Unsafe outcomes: Relation count proves a lead from another property; GA4 and
pixel cohorts are presented as directly equivalent when not scoped alike.
Dependencies: S4.
Expected files: attribution pages/libraries and tests.
Write boundaries: Attribution only.
Tests required: Multi-property, org-level visitor, denied selection, relation
count mutation.
Runtime verification: Both attribution pages at desktop/mobile.
Migration/backfill notes: None.
External docs needed: None.
Acceptance criteria: All displayed stages derive from the same scope policy.
Exit evidence: 2026-08-04 — forward and reverse attribution now accept
`PropertyDataScope`; sessions use their direct ingest-time property attribution,
while visitors, leads, headline stages, flow, and email signal matching share
the same ACTIVE/access-controlled scope. Removed nested `Visitor._count.leads`
and session relation counts; separately scoped lead/session queries now prove
outcomes and touch frequency. Selected-property views no longer blend org-level
GA4 reach into property-scoped cohorts, and the portfolio disclosure is honest.
Attribution suites pass 18/18 and the combined foundation passes 58/58; full
ESLint error-only, TypeScript, and diff checks pass. AST enforcement covers both
attribution repositories and rejects relation-count/runtime-wrapper mutations.
Browser verification remains grouped into S7's fixture/deployment QA gate.
Parallelization: Single-threaded.
Blocked on: Nothing.

### S6 - Scope Funnel and Lead Journey

Status: done
Tier: T1
Type: backend/frontend
Actor/trigger: Operator opens portfolio funnel or dashboard journey.
Action: Remove `null = org-wide` from funnel/journey contracts.
Invariant protected: Stage totals and by-property rows use ACTIVE scope.
Intentional behaviour changes: Default cohort becomes ACTIVE portfolio.
Previous intended behaviours preserved: Conversion math, stage evidence,
date windows, and access-filtered property table.
Unsafe outcomes: Journey and funnel disagree; tour evidence is org-wide while
the cohort is scoped; empty scope returns all.
Dependencies: S5.
Expected files: report libraries, portfolio/dashboard callers, tests.
Write boundaries: Funnel/journey only.
Tests required: Stage-source cohort parity and null-regression mutation.
Runtime verification: Portfolio report and dashboard journey.
Migration/backfill notes: None.
External docs needed: None.
Acceptance criteria: No nullable scope parameter; all evidence counts scoped.
Exit evidence: 2026-08-04 — portfolio funnel and lead journey now require
`PropertyDataScope`; visitor/lead totals, required tour/application evidence,
stage groupings, off-ramps, tracking availability, and by-property rows all use
the same ACTIVE/access-controlled cohort. Dashboard and portfolio callers share
the resolved scope, including explicit org-level nullable rows. Empty scope
matches the sentinel instead of widening. Funnel suites pass 10/10 and the
combined foundation passes 68/68; full ESLint error-only, TypeScript, and diff
checks pass. AST enforcement now covers both report repositories.
Parallelization: Single-threaded.
Blocked on: Nothing.

### S7 - Close remaining portal count leaks

Status: done
Tier: T1
Type: backend/frontend
Actor/trigger: Operator navigates portal surfaces.
Action: Scope nav badges, chatbot metrics, Creative Studio, referrals, and SEO
draft/action lists/counts using domain repositories.
Invariant protected: A number that controls visibility or summary matches the
rows the user can open.
Intentional behaviour changes: Imported/excluded-property rows disappear from
normal portal views.
Previous intended behaviours preserved: Org-level creative/chatbot/draft rows
where product policy explicitly includes them; user access; status filters.
Unsafe outcomes: Badge/list mismatch, relation application counts widening,
or empty property scope hiding valid organization-level records unexpectedly.
Dependencies: S6.
Expected files: `app/portal/layout.tsx`, chatbot, creative, referrals, SEO drafts,
supporting repositories/tests.
Write boundaries: Named portal surfaces only.
Tests required: Per-surface count/list parity and zero-ACTIVE behavior.
Runtime verification: Browser QA for all named routes.
Migration/backfill notes: None.
External docs needed: None.
Acceptance criteria: Counts and visible rows share the same scope builder.
Exit evidence: 2026-08-04 — navigation badges now intersect ACTIVE properties
with user access; Insight, report, Creative, lead, visitor, tour, application,
lease, work-order, and conversation badges use explicit nullable/required
policies. Chatbot analytics/insights, Creative rows+counts, Referral properties+
leads+applications, Content lists, SEO draft rows+counts, and SEO opportunities
share resolved scope. Fixed a swallowed Referral QR error while in scope. Portal
parity tests pass 6/6 and the combined foundation passes 74/74; full ESLint
error-only, TypeScript, and diff checks pass. Browser QA cannot exercise these
uncommitted server-query changes without a fixture database or preview; it is
explicitly deferred to the release verification gate rather than using prod DB.
Parallelization: Single-threaded due shared layout/scope contracts.
Blocked on: Nothing.

### S8 - Make customer emails match portal scope

Status: done
Tier: T1
Type: integration
Actor/trigger: Daily Insight and weekly pixel cron runs.
Action: Use shared scoped repositories and deduplicate Cursive digest dispatch by
effective property/portfolio scope.
Invariant protected: Email totals equal the corresponding portal totals.
Intentional behaviour changes: Per-property integrations send property digests;
legacy org integration sends one ACTIVE-portfolio digest.
Previous intended behaviours preserved: Recipient resolution, per-tenant error
isolation, and cron telemetry.
Unsafe outcomes: Duplicate emails, wrong property totals, one tenant failure
stopping others, or N+1 work exceeding duration.
Dependencies: S7.
Expected files: two cron routes, email payload tests, query repository.
Write boundaries: Digest cron/query behavior only; no real send.
Tests required: Legacy + three property integrations, duplicate recipients,
zero ACTIVE properties, one failing tenant.
Runtime verification: Render/capture email payloads locally with mocked send.
Migration/backfill notes: None.
External docs needed: None.
Acceptance criteria: One email per effective digest scope and exact portal parity.
Exit evidence: 2026-08-04 — daily Insight digest consumes the same scoped
repository as the portal. Weekly pixel dispatch now plans one job per effective
portfolio/property scope, merges duplicate integration recipients, skips
inactive property integrations and organizations with no ACTIVE properties,
and computes all four visitor metrics under the same runtime scope capability.
Per-scope failures continue safely and increment cron `errorCount`. Job,
metric, and dispatch-isolation suites pass 9/9; focused ESLint, full TypeScript,
and diff checks pass. Sends were mocked; no external email or database access.
Parallelization: Single-threaded.
Blocked on: Nothing.

### S9 - Correct admin truth and raw labels

Status: done
Tier: T2
Type: backend/frontend
Actor/trigger: Agency operator opens clients, tenants, Insights, Leads, or demo
readiness.
Action: Replace misleading relation counts/groupings with ACTIVE recounts; retain
raw AppFolio diagnostics under explicit labels.
Invariant protected: Admin totals state whether they mean enabled product scope
or raw synced inventory.
Intentional behaviour changes: Client/tenant/velocity/readiness totals become
ACTIVE-scoped; raw diagnostic labels become explicit.
Previous intended behaviours preserved: Cross-client visibility for agency roles,
integration troubleshooting, and org filtering.
Unsafe outcomes: Hiding raw sync failures, N+1 explosion across clients, or
labeling a raw total as enabled.
Dependencies: S8.
Expected files: admin client/tenant/insight/lead pages, demo readiness, admin
aggregation repository/tests.
Write boundaries: Admin read surfaces only.
Tests required: Batched multi-org grouping, zero ACTIVE with 135 raw properties,
raw-vs-enabled label assertions.
Runtime verification: Admin browser QA.
Migration/backfill notes: None.
External docs needed: None.
Acceptance criteria: SG-like fixture renders enabled=1 and raw=135 only where
raw inventory is intentionally shown.
Exit evidence: 2026-08-04 — client and tenant property totals use one batched
ACTIVE-property grouping; client 30-day leads, lead velocity, cross-tenant lead
rows/counts, cross-portfolio Insights/SEO, action items, and demo-readiness
metrics exclude imported/excluded property data while retaining org-level rows
only on nullable portfolio surfaces. Client property tabs and readiness use
ACTIVE rows. AppFolio diagnostics intentionally retain raw inventory and now
label it `Raw properties` / `Raw listings`. Admin truth and parity tests pass
8/8 (94/94 with adjacent admin/Insight suites); full ESLint, TypeScript, and
diff checks pass. Browser QA remains deferred to a fixture/preview runtime.
Parallelization: Single-threaded.
Blocked on: Nothing.

### S10 - Define durable backfill request schema

Status: done
Tier: T2
Type: schema
Actor/trigger: Future lifecycle activation service.
Action: Design Prisma model and handwritten additive SQL for durable request,
target properties, attempts, phase state, and error visibility; do not apply it.
Invariant protected: Pending work is durable and auditable.
Intentional behaviour changes: None until behavior slices use the model.
Previous intended behaviours preserved: Existing timestamp remains readable
during transition; current sync can run before deploy order advances.
Unsafe outcomes: Destructive migration, required column without backfill,
deploy-order P2022, or unbounded JSON without schema validation.
Dependencies: S9.
Expected files: Prisma schema, new migration SQL, generated client only when safe,
migration tests/docs.
Write boundaries: Schema/migration only.
Tests required: SQL shape, indexes/uniqueness, Prisma generation/type-check.
Runtime verification: No database apply.
Migration/backfill notes: Additive/non-destructive; apply requires explicit approval.
External docs needed: Current Prisma 7 migration/client generation docs.
Acceptance criteria: Reviewed additive schema supports concurrency/retry lifecycle.
Exit evidence: 2026-08-04 — added expand-only Prisma models and handwritten SQL
for durable requests, target properties, and per-target phase outcomes. A
partial unique index permits only one PENDING/RUNNING/PARTIAL request per org;
legacy `backfillRequestedAt` remains for deploy compatibility. No DML, drops,
or existing-table rewrite. Five migration contract tests pass, Prisma schema
validation passes, and diff check is clean. Migration was not applied.
Parallelization: Single-threaded schema.
Blocked on: Production apply approval only, not local authoring.

### S11 - Centralize transactional property promotion

Status: done
Tier: T1
Type: backend/state transition
Actor/trigger: Singular, bulk, curate-all, or wizard promotion to ACTIVE.
Action: Route all paths through one service that authorizes and transactionally
updates lifecycle, writes audit, and creates/merges backfill work.
Invariant protected: ACTIVE and required backfill cannot partially commit.
Intentional behaviour changes: Already-ACTIVE promotion becomes a no-op.
Previous intended behaviours preserved: Agency impersonation scope, restricted
property access, sticky OPERATOR lifecycle, curation behavior.
Unsafe outcomes: Wrong-org activation, clobbered ID gate, duplicate requests,
bulk multi-org misattribution, or audit/backfill split-brain.
Dependencies: S10 migration available in the target environment before behavior
deploy; local tests can use mocks/isolated DB only.
Expected files: domain service, actions, wizard routes, tests.
Write boundaries: Activation paths only.
Tests required: Wrong org/user, restricted IDs, imported->active, already active,
bulk multi-org, transaction rollback, concurrent request merge.
Runtime verification: Local mocked/isolated test; no production write.
Migration/backfill notes: Behavior deploy after migration apply.
External docs needed: Prisma transaction behavior via Context7.
Acceptance criteria: No direct ACTIVE promotion remains outside the service.
Exit evidence: 2026-08-04 — `promotePropertiesToActive` now verifies exact
tenant/property grants and performs lifecycle, per-property audit events,
durable request merge, targets, and required phase rows in one serializable
transaction. Already-ACTIVE rows are no-ops; agency multi-org batches separate
by org; write conflicts retry the entire transaction. Singular, bulk,
activate-all, and both onboarding resume paths delegate existing-property
promotion to the service. An AST rule rejects new direct ACTIVE updates outside
the service while allowing explicit new-property creation. Activation/guard
suites pass 52/52; full ESLint, TypeScript, and diff checks pass. Runtime deploy
remains gated on applying S10 first.
Parallelization: Single-threaded state surface.
Blocked on: Migration deploy ordering for runtime rollout.

### S12 - Make AppFolio backfill phase-aware

Status: done
Tier: T2
Type: integration/background job
Actor/trigger: AppFolio cron claims a pending activation backfill.
Action: Use 180-day activation window, track required phases including work
orders, persist attempts/outcomes, and complete only after applicable phases.
Invariant protected: A failed date-windowed phase cannot be skipped permanently.
Intentional behaviour changes: Backfill completion is phase-aware; bounded retry
creates visible terminal failure instead of infinite loop.
Previous intended behaviours preserved: Unsupported reports stop retrying;
incremental sync remains cheap; partial normal sync can still report partial.
Unsafe outcomes: Work orders retire request, watermark advances over missing
history, request loops forever, newer activation swallowed, or Vercel timeout
leaves invisible state.
Dependencies: S11.
Expected files: AppFolio worker, cron telemetry/admin warning surface, tests.
Write boundaries: Backfill claim/phase/completion logic only.
Tests required: Each phase failure, unsupported phase, retry exhaustion,
concurrent newer request, timeout/re-entry, 30->180 mutation, any-phase mutation.
Runtime verification: Fake AppFolio client; no live API/database.
Migration/backfill notes: No production execution in implementation tests.
External docs needed: AppFolio report semantics only if current contract is
unclear; do not expose credentials.
Acceptance criteria: Required phases determine completion and failure is visible.
Exit evidence: 2026-08-04 — the worker atomically claims PENDING/PARTIAL or
stale RUNNING durable requests, honors their exact 180-day window, persists
per-target phase outcomes, and completes only when all required phases are
COMPLETED/UNSUPPORTED. Leads, showings, applications, residents, leases, and
work orders all report outcomes; work orders now use the same failure/skip
tracking. Three failed attempts become visible terminal failure, excluded from
normal auto-claim; explicit operator sync can retry. Final writes require
RUNNING status and count newly merged target phases before completion. Backfill,
skip, status, and activation suites pass 39/39; ESLint, TypeScript, and diff
checks pass. No database or AppFolio call ran.
Parallelization: Single-threaded worker.
Blocked on: Nothing after S11.

### S13 - Build reversible legacy Insight cleanup

Status: done
Tier: T1
Type: data tooling
Actor/trigger: Agency operator explicitly previews then approves cleanup.
Action: Create dry-run manifest, cleanup audit persistence, bounded mutation, and
restore command for Insights linked to non-ACTIVE properties.
Invariant protected: No Property or legacy child row is deleted; every changed
Insight can be restored to its prior workflow state.
Intentional behaviour changes: Only approved legacy Insights become dismissed/
acted after a separate execution approval.
Previous intended behaviours preserved: Current open/acknowledged workflow and
historical record retention.
Unsafe outcomes: Wrong org/ACTIVE rows selected, unreviewed write, non-restorable
status, oversized transaction, or accidental child purge.
Dependencies: S12 scoping/backfill foundation complete.
Expected files: cleanup script/service, audit model if needed, tests, runbook.
Write boundaries: Tooling only; dry-run default.
Tests required: Selection predicate, idempotency, bounded batching, restoration,
ACTIVE exclusion, no Property/delete calls.
Runtime verification: Synthetic fixtures. Production dry-run requires approval;
production write requires a second explicit approval.
Migration/backfill notes: Any audit table is additive and separately deployed.
External docs needed: None.
Acceptance criteria: Dry-run output fully predicts reversible writes.
Exit evidence: 2026-08-04 — preview selects only open/acknowledged Insights
linked to non-ACTIVE properties and emits a deterministic manifest containing
every restorable workflow field. Apply/restore require the exact SHA-256 preview
hash, re-check exact org/property/status, execute in per-org batches of 100,
and write audit events. Restore reinstates status, acknowledgement, dismissal,
and snooze fields. No Property/Insight delete operation exists. Ten tests pass;
ESLint, TypeScript, and diff checks pass. No production preview or mutation ran.
Parallelization: Single-threaded data tooling.
Blocked on: Production dry-run/write approval only.

### S14 - Unify billable property semantics

Status: blocked
Tier: T1
Type: billing
Actor/trigger: Portal/admin/Stripe calculates property quantity.
Action: Produce affected-org preview for ACTIVE versus current IMPORTED+ACTIVE
quantity, obtain decision, then centralize one `BillableProperty` definition.
Invariant protected: Quote, subscription quantity, invoice, and admin controls
use the same approved quantity.
Intentional behaviour changes: Undecided until preview approval.
Previous intended behaviours preserved: No price or Stripe change by inference.
Unsafe outcomes: Silent charge change, retroactive invoice drift, or calling an
IMPORTED-inclusive count marketable.
Dependencies: S9; safe-feature-slice and explicit product decision.
Expected files: billing page, Stripe quantity sync, billing domain/test files.
Write boundaries: Billing only.
Tests required: Quantity parity across all consumers; no Stripe network calls.
Runtime verification: Preview only before approval.
Migration/backfill notes: None expected.
External docs needed: Current Stripe quantity/update semantics via official docs.
Acceptance criteria: Blocked until Adam approves definition after preview.
Exit evidence: Redacted organization impact table and written decision.
Parallelization: Single-threaded Tier 1.
Blocked on: Approved billable-property definition.

### S15 - Audit UI truth and visual drift

Status: done
Tier: T3
Type: verification/design
Actor/trigger: Codex after correctness/admin foundation.
Action: Browser-audit portal routes at desktop/mobile against the marketing site
and current dashboard reference system.
Invariant protected: Audit does not redesign the approved references or invent a
second visual language.
Intentional behaviour changes: None; audit only.
Previous intended behaviours preserved: Light-only, Norman-brief polish, Lucide,
no emoji, tracking/intelligence copy.
Unsafe outcomes: Screenshot artifacts logged as bugs; aesthetic changes masking
data defects; broad global CSS plan without route evidence.
Dependencies: S9 and S12; S14 may remain separately blocked.
Expected files: Audit artifact/screenshots only.
Write boundaries: `docs/audits` or approved artifact folder.
Tests required: Route render/crawl and responsive width sweep.
Runtime verification: Required via local app/browser with non-production-safe
fixture/session strategy.
Migration/backfill notes: None.
External docs needed: None.
Acceptance criteria: Every route classified as match, minor drift, major drift,
or blocked, with reference screenshots and actionable findings.
Exit evidence: 2026-08-04 — `docs/audits/2026-08-04-ui-truth-audit.md`
classifies every current route family against the protected dashboard/product
system, scores accessibility/performance/responsive/theming/anti-pattern health,
and records 13 prioritized findings. The audit used the current source tree,
project design context, and the existing authenticated 1440x900 production
capture set without connecting this worktree to production data. Fresh branch
desktop/mobile proof remains an explicit S17 preview gate.
Parallelization: Single-threaded under current no-agent instruction.
Blocked on: Safe local browser data strategy if production auth/data is required.

### S16 - Converge portal route families

Status: in_progress
Tier: T3
Type: frontend
Actor/trigger: Operator uses a route family identified in S15.
Action: Migrate one route family per sub-slice to actual reference tokens and
components; update this plan with child slices after audit.
Invariant protected: Marketing site/dashboard remain unchanged references.
Intentional behaviour changes: Presentation and interaction only unless a
separate correctness slice says otherwise.
Previous intended behaviours preserved: Route capabilities, permissions, data
semantics, responsive functionality, accessibility.
Unsafe outcomes: One global CSS rewrite, destructive component churn, new dark
theme, emoji, or property-management copy.
Dependencies: S15 and relevant correctness slice.
Expected files: Determined per route-family child slice.
Write boundaries: One route family plus shared component only when proven
reusable by at least two migrated surfaces.
Tests required: Existing feature tests, accessibility checks, visual/browser QA.
Runtime verification: Required at desktop/mobile for every child slice.
Migration/backfill notes: None.
External docs needed: Current framework/component docs only when API changes.
Acceptance criteria: Each family visually matches references without behavior
regression; exact child slices are added before code begins.
Exit evidence: Before/after screenshots and checks.
Parallelization: Single-threaded unless later explicitly authorized.
Child slices:
- S16A: Systemic interaction hardening — reduced motion plus accessible custom
  dialog/mobile-drawer focus behavior. **Done 2026-08-04:** added a shared
  Radix dialog primitive; migrated confirm, email, and SMS dialogs; migrated
  mobile navigation to the focus-managed Sheet; labeled disabled icon actions
  and the SMS field; and added a global reduced-motion guard. A follow-up scan
  migrated every remaining actionable overlay across content review, vault,
  proposals, reputation, occupancy, global search, and SEO drafting. The only
  remaining dialog role is the customer-popup preview renderer. Structural
  tests pass 3/3; focused ESLint, full TypeScript, and diff checks pass.
- S16B: Admin content workflows — approvals and drafts adopt canonical page,
  empty-state, control, and sharp-surface primitives. **Done 2026-08-04:**
  approvals and drafts now use `PageHeader`, `SectionCard`, `EmptyState`,
  `ls-select`, sharp surfaces, consistent focus rings, and compact queue
  hierarchy across list and detail routes. Structural tests pass 3/3 (6/6
  with S16A); focused ESLint, full TypeScript, and diff checks pass.
- S16C: Admin site intelligence — list/detail pages adopt the same system.
  **Done 2026-08-04:** list/detail pages use canonical headers and empty
  states, sharp surfaces and controls, compact summary metrics, and a full
  border brand-voice callout instead of the banned colored side stripe.
  Structural tests pass 2/2 (8/8 across S16A-S16C); focused ESLint, full
  TypeScript, and diff checks pass.
- S16D: Loading/control consistency — close route-local skeleton gaps and
  normalize remaining product-control geometry. **Done 2026-08-04:** the
  shared page skeleton now uses the sharp product vocabulary and twelve
  data-backed routes gained route-shaped list/detail/dashboard/form loading
  states. The retired `/portal/campaigns` redirect is intentionally excluded.
  Structural tests pass 2/2 (10/10 across S16A-S16D); focused ESLint, full
  TypeScript, and diff checks pass.
- S16F: Portal-shell performance — reduce blocking query fan-out without
  moving scope or authorization decisions to the browser. **Done 2026-08-04:**
  established tenants skip the five-query setup derivation; property curation
  shares the property feed; AppFolio connection/status shares one read; and
  eight boolean nav gates use first-row probes instead of full counts. The
  estimated blocking database budget fell from about 25 operations to 18.
  Query-budget, scope-parity, and runtime-guard tests pass 15/15; focused
  ESLint, full TypeScript, and diff checks pass. Runtime timing remains S16E.
- S16E: Safe-preview desktop/mobile visual proof and final polish.
  **Blocked:** branch rendering requires a non-production fixture database or
  preview environment. Production screenshots cannot prove uncommitted UI.
  2026-08-04 environment audit found Docker/local Postgres but the application
  runtime is intentionally coupled to the Neon adapter; adding a second
  production database adapter solely for QA would create needless architecture
  drift. Recommended unblock: a new empty Neon preview database seeded only
  with synthetic fixtures, pending Adam's authorization to create the external
  resource.
- S16G: Regenerate the stale design contract from current runtime tokens.
  **Blocked:** Impeccable's document workflow requires a specific refresh/merge
  decision when `DESIGN.md` already exists. The recommended decision is a full
  refresh into its machine-readable six-section format, preserving the current
  dashboard and marketing site as separate protected references.
Blocked on: S16E requires a non-production preview/session strategy; S16A-S16D
can proceed from verified source and reference evidence.

### S17 - Verify and release the program safely

Status: blocked
Tier: T1
Type: verification/ops
Actor/trigger: All required implementation slices have exit evidence.
Action: Run full checks, browser QA, adversarial review, migration ordering,
approved data operations, and `cap` release workflow.
Invariant protected: No deploy precedes schema or approval; no claimed success
without real proof.
Intentional behaviour changes: Release only the approved completed slices.
Previous intended behaviours preserved: Four pre-existing commits are reviewed
and included/excluded deliberately; Vercel builds are batched.
Unsafe outcomes: Push without approval, deploy missing column/table, cleanup or
billing mutation bundled silently, `.env*` staged, or test weakened.
Dependencies: S13-S16 as applicable; S14 may be explicitly deferred.
Expected files: No new behavior; release documentation/evidence only.
Write boundaries: Plan/progress evidence and approved release metadata.
Tests required: `rtk proxy pnpm exec vitest run`, `pnpm exec tsc --noEmit`,
ESLint, `rtk proxy pnpm exec next build`, mutations, browser matrix.
Runtime verification: Required.
Migration/backfill notes: Apply approved migrations before dependent code;
verify columns/tables without exposing values.
External docs needed: None beyond slice-specific evidence.
Acceptance criteria: All included slices done/skipped with evidence; required
approvals recorded; dual review passes; cap succeeds.
Exit evidence: Exact command output, screenshots, review result, migration
verification, and release result.
Pre-release evidence: 2026-08-04 — full Vitest passed 195/195 files and
2,024/2,024 tests; repository ESLint (`--quiet`), TypeScript (`--noEmit`), and
`git diff --check` all passed. This proves the current source state only; build,
browser proof, adversarial review, migration approval, and release approval
remain outstanding.
Parallelization: Never parallelize release/git/migrations.
Blocked on: Explicit migration, production-data, commit/push/deploy approvals.

## Verification Gates

- Automated checks: Focused RED/GREEN tests per slice; original-defect mutation
  proof; full Vitest, TypeScript, ESLint, Next build before release.
- Runtime checks: Browser QA for every customer/admin/frontend slice; email
  payload rendering for cron slices; fake external clients for AppFolio.
- Migration checks: Handwritten additive SQL review; schema/client generation;
  migration first, code second; production apply only with approval.
- Security/auth checks: Tenant and UserPropertyAccess boundaries, denied/mixed
  selections, agency impersonation, wrong-org activation, explicit raw scope.
- Observability/audit checks: Scope rejection context, digest error isolation,
  backfill phase/attempt state, activation audit, reversible cleanup manifest.

## Subagent Plan

No subagents are planned or authorized. The repository has shared-contract,
schema, branch-switch, and production-environment hazards, and current session
instructions require local single-agent execution unless Adam explicitly asks
for delegation or parallel agents.

## Update Rules

- Move only the current slice to `in_progress`.
- Mark `done` only after exact exit evidence is recorded.
- Mark `blocked` with the missing decision, approval, dependency, or failing
  check.
- Add discoveries as new slices/follow-ups; do not silently expand an active
  slice.
- Keep skipped/rejected work visible with reasons.
- Recheck branch/status before every long edit or verification run.
- Do not initialize Prisma or execute scripts under `.env.local` unless the
  active slice explicitly authorizes a read-only/live action.
- Never run destructive Prisma commands.
