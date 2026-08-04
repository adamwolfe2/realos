# Product Truth Foundation Thin Slice Plan

Status: READY
Last updated: 2026-08-04
Owner: Codex

## Working Brief

- **Feature or fix:** Establish one canonical, read-only product contract and discrepancy audit across LeaseStack's current pricing, marketplace, proposal, entitlement, marketing, and Stripe metadata. This is Phase A of the approved Product Portfolio and Connected Data Foundation design.
- **Primary actors:** LeaseStack product/admin team; future implementation agents; no customer action in this slice.
- **Core invariant:** Introducing product truth must not change any customer's price, subscription, entitlement, module flag, checkout behavior, proposal, marketing page, or product access.
- **Previous intended behaviours:** Existing billing math, module-flag revocation, trial behavior, marketplace activation, proposal seeding, Stripe lookup keys, webhook entitlement resolution, and current routes continue unchanged.
- **Unsafe outcomes:** Stripe or database mutation; customer-visible catalog changes; a legacy subscription losing access; a blocked product becoming purchasable; a misleading “consistent” result that hides known catalog drift; importing server-only modules into browser code.
- **Current evidence:** Approved design at `.claude/specs/2026-08-04-product-portfolio-and-connected-data-design.md`; `lib/billing/features.ts`; `lib/billing/catalog.ts`; `lib/billing/feature-prices.ts`; `lib/billing/feature-stripe.ts`; `lib/marketplace/catalog.ts`; `lib/proposals/catalog.ts`; `lib/copy/marketing.ts`; `app/(platform)/features/page.tsx`; `app/(platform)/features/*/page.tsx`; `app/(platform)/terms/page.tsx`; existing billing and Stripe regression tests.
- **Assumptions:** The first slice is intentionally static and read-only. Existing catalogs remain runtime sources. Registry readiness expresses approved product truth, while adapters report legacy reality without silently correcting it. No live Stripe, Neon, Vercel, AppFolio, Google, Meta, GA4, GSC, or Cursive call is required.
- **Out of scope:** Capability-profile schema; sync changes; admin activation UI; customer-facing catalog alignment; marketing edits; proposal edits; price changes; entitlement migration; Stripe reconciliation against the live API; migrations; deployment; the five outcome-product workflow improvements.

## Risk Classification

- **Overall tier:** Tier 1 because the domain includes money and entitlements, even though this first slice is read-only.
- **Live-data risk:** None allowed. All reads use version-controlled constants and source metadata; no production database or external API access.
- **Migration risk:** None. No schema or data migration.
- **External-contract risk:** Low in this slice. Stripe identifiers are compared as strings only; no third-party API signature is used.

## Dependency Graph

| Node | Depends on | Parallel? | Shared-state risk | Notes |
| --- | --- | --- | --- | --- |
| S0 | None | No | Test baseline | Characterize legacy sources and protect current behavior first. |
| S1 | S0 | No | Shared product types | Define the canonical contract and approved entries without consumers. |
| S2 | S1 | Yes, by adapter | Imports existing catalogs | Build pure read-only legacy source adapters with disjoint files. |
| S3 | S2 | No | Shared discrepancy schema | Compare registry expectations with normalized legacy records. |
| S4 | S3 | No | CLI/report output | Generate a deterministic baseline audit without network or DB access. |
| S5 | S3, S4 | No | Test expectations | Add policy and regression gates around known versus new drift. |
| S6 | S5 | No | Full repository checks | Verify, document evidence, and prepare implementation review. |

## Audit Triage

Source artifacts: approved design plus read-only product/marketing/feature/integration audits completed 2026-08-04.

| Finding | Verified against current code? | Disposition | Reason |
| --- | --- | --- | --- |
| Pricing, marketplace, and proposals are separate catalogs | Yes — `FEATURE_CATALOG`, `MARKETPLACE_ENTRIES`, and `PROPOSAL_CATALOG` | S0-S4 | Foundational drift this slice must expose. |
| Marketplace already withholds some unready modules | Yes — `ready: false` on Pixel and Popups | Preserve and normalize in S2 | Existing safety behavior must not regress. |
| Proposal catalog sells unsupported or differently named capabilities | Yes — active Pro, audience, outbound, integration, and service lines | Report in S3-S4 | Do not silently remove or sell them differently in this slice. |
| Managed-ads/creative wording conflicts with software-only boundary | Yes — feature page and proposal copy versus Terms and approved design | Report as critical claim conflict | Customer-facing copy changes belong to later approved work. |
| Stripe per-feature sync can mutate external state | Yes — `syncAllFeaturePricesToStripe()` | Explicitly excluded | The audit must never import or invoke mutating functions. |
| Existing subscriptions require preservation | Yes — per-feature and legacy-tier paths coexist | Protect with S0/S5 tests | No runtime consumer changes in Phase A. |
| AppFolio and outcome-product readiness need capability evidence | Yes | Deferred | Belongs to Phase B/C, not Product Truth foundation. |

## Progress

| Slice | Status | Tier | Owner | Evidence | Next gate |
| --- | --- | --- | --- | --- | --- |
| S0 | done | T1 | A1 | 12 characterization assertions pass; one intentional registry RED; 80 existing regressions pass; ESLint/diff check pass. | S1 registry contract. |
| S1 | done | T1 | Main | 21 focused tests pass; ESLint and TypeScript pass; registry has no runtime consumers. | S2 source adapters. |
| S2 | done | T1 | A2 + A3 | 41 focused tests pass; adapters cover all planned sources; ESLint, TypeScript, forbidden-import scan, and diff check pass. | S3 discrepancy policy. |
| S3 | done | T1 | Main | 47 focused tests pass; discrepancy cases cover duplicate/unknown identities, unsupported self-serve products, service conflicts, readiness, Stripe proof, claims, entitlements, price drift, and stable sorting; ESLint, TypeScript, and diff check pass. | S4 deterministic baseline. |
| S4 | done | T2 | Main | 51 focused tests pass; CLI generates a 135-record baseline with 29 critical and 40 warning findings; two runs produced identical SHA-256 hashes; ESLint, TypeScript, and diff check pass. | S5 regression gates. |
| S5 | in_progress | T1 | Main | none | Unsafe mappings fail tests; known drift remains explicit. |
| S6 | pending | T1 | Main | none | Full checks and diff review pass. |

## Slices

### S0 - Characterize current catalog and entitlement behavior

Status: done
Tier: T1
Type: verification
Actor/trigger: Developer runs focused tests before adding the registry.
Action: Add characterization tests for current stable keys, catalog counts/categories, marketplace withheld-state behavior, proposal activity, billing selection math, and legacy/per-feature entitlement paths.
Invariant protected: The registry work cannot accidentally reinterpret current billing or access behavior.
Intentional behaviour changes: None.
Previous intended behaviours preserved: Base plus selected-feature math; always-on module behavior; cancel/revocation coverage; legacy tier fallback; marketplace `ready: false`; stable proposal slugs and Stripe lookup keys.
Unsafe outcomes: Tests encode unsupported promises as approved truth; tests call Prisma or Stripe; brittle assertions snapshot all prose.
Dependencies: None.
Expected files: `__tests__/product-truth-characterization.test.ts`; existing billing tests only if a missing public export prevents characterization.
Write boundaries: Tests only unless a pure existing constant needs a non-behavioral export.
Tests required: New tests must initially fail because the normalized contract does not exist, while existing billing/Stripe tests remain green.
Runtime verification: Not required; no UI or runtime behavior changes.
Migration/backfill notes: None.
External docs needed: None.
Acceptance criteria: Stable identifiers and safety-relevant statuses are captured without approving customer-facing copy or prices as correct.
Exit evidence: `__tests__/product-truth-characterization.test.ts` has 12 passing assertions and one intentional RED requiring `lib/products/registry.ts`; six existing regression files pass 80 tests; focused ESLint and `git diff --check` pass.
Parallelization: Single-threaded; establishes the baseline for every later worker.
Blocked on: Nothing.

### S1 - Define the canonical product contract and registry

Status: done
Tier: T1
Type: backend
Actor/trigger: Internal code imports product metadata for analysis only.
Action: Add pure types and approved entries for Connected Data Foundation, Attribution, five outcome products, and Website Build. Include classification, readiness, scope, module/legacy aliases, setup requirements, activation evidence, KPI, degraded-state summary, commercial policy, and source references.
Invariant protected: Registry metadata cannot grant access, calculate a charge, or mutate an existing source.
Intentional behaviour changes: A new internal source of approved product truth exists; no current consumer switches to it.
Previous intended behaviours preserved: All existing catalogs and runtime gates remain authoritative during this slice.
Unsafe outcomes: Exporting secrets; importing Prisma/Stripe; embedding customer-specific IDs; representing managed ads or creative as products; treating Attribution as a tactical add-on.
Dependencies: S0.
Expected files: `lib/products/types.ts`; `lib/products/registry.ts`; `lib/products/index.ts`.
Write boundaries: New `lib/products/` contract files only.
Tests required: Unique stable keys; exhaustive readiness/classification values; Website Build classified as service; Connected Data Foundation and Attribution classified as foundation; no managed-ad/creative entry; registry entries immutable at runtime.
Runtime verification: Not required.
Migration/backfill notes: None.
External docs needed: None.
Acceptance criteria: The approved design is expressible in typed, pure data and compiles without importing server-only or mutable infrastructure.
Exit evidence: Eight registry tests plus 13 characterization tests pass; focused ESLint and `tsc --noEmit` pass; source scan confirms only tests and the new barrel import the registry.
Parallelization: Single-threaded because all adapters depend on this shared contract.
Blocked on: Nothing.

### S2 - Normalize existing product sources through read-only adapters

Status: done
Tier: T1
Type: backend
Actor/trigger: Product-truth audit requests normalized legacy records.
Action: Add pure adapters for à-la-carte billing, tier/add-on billing, marketplace, proposals, marketing/Terms claims, module entitlements, and static Stripe mappings. Each record includes its source, stable identifier, label, status, price metadata, entitlement metadata, and evidence path.
Invariant protected: Adapters observe current source data without becoming runtime consumers or invoking DB/network/mutation code.
Intentional behaviour changes: Existing source metadata becomes comparable in one internal shape.
Previous intended behaviours preserved: No source array, checkout, marketplace, proposal, webhook, or marketing renderer changes.
Unsafe outcomes: Importing `syncAllFeaturePricesToStripe`; calling `ensureCatalogSeeded`; querying `FeaturePrice`; reading environment secrets; causing a `server-only` adapter to leak into client bundles.
Dependencies: S1.
Expected files: `lib/products/adapters/billing-features.ts`; `billing-tiers.ts`; `marketplace.ts`; `proposals.ts`; `marketing.ts`; `entitlements.ts`; `stripe-static.ts`; `lib/products/adapters/index.ts`.
Write boundaries: New adapter files only. If source constants cannot be safely imported, extract pure constants in a separate, behavior-preserving prerequisite rather than duplicating them.
Tests required: Adapter output is deterministic; no adapter exports a mutation; all source identifiers are present; withheld/inactive/coming/concierge states survive normalization.
Runtime verification: Not required.
Migration/backfill notes: None.
External docs needed: None because only local static metadata is read.
Acceptance criteria: Every known commercial/product source can be compared without database or external access.
Exit evidence: Marketplace/proposal adapters pass seven tests; billing/entitlement/Stripe/marketing adapters pass 11 tests; aggregate contract and prior registry/characterization tests bring the focused total to 41. ESLint, `tsc --noEmit`, forbidden-import assertions, mocked Prisma non-access, and `git diff --check` pass.
Parallelization: Parallel-safe after S1. One worker per adapter family with disjoint files; main agent owns the barrel export and integration.
Blocked on: Nothing.

### S3 - Build the discrepancy engine and policy severity model

Status: done
Tier: T1
Type: backend
Actor/trigger: Internal audit compares registry expectations with normalized legacy sources.
Action: Produce deterministic findings for missing products, duplicate identifiers, name drift, readiness conflicts, unsupported sellable claims, price differences, missing/extra entitlements, missing Stripe mappings, service/software conflicts, and source-only orphan products.
Invariant protected: The audit exposes drift; it never resolves ambiguity by changing a source or declaring mismatches safe.
Intentional behaviour changes: Product drift becomes machine-readable with severity and remediation ownership.
Previous intended behaviours preserved: Known mismatches remain visible and no customer behavior changes.
Unsafe outcomes: Reporting `PASS` while critical conflicts exist; treating missing Stripe IDs as harmless for sellable billable products; flagging Website Build as invalid merely because it is a service; conflating expected legacy aliases with duplicates.
Dependencies: S2.
Expected files: `lib/products/discrepancies.ts`; `lib/products/policies.ts`; `__tests__/product-truth-discrepancies.test.ts`.
Write boundaries: Product audit engine and tests only.
Tests required: Table-driven cases for every severity; exact known critical conflicts include managed ads/creative, unsupported proposal products, and inconsistent readiness; unknown new drift fails the guard.
Runtime verification: Not required.
Migration/backfill notes: None.
External docs needed: None.
Acceptance criteria: Same inputs always yield the same sorted findings; every finding cites source IDs/paths and a product key or explicit orphan classification.
Exit evidence: Six discrepancy-engine tests and 41 prior product-truth tests pass. Critical and warning policies are deterministic; proposal tiers and approved legacy mappings avoid false unsupported-product findings. Focused ESLint, `tsc --noEmit`, and `git diff --check` pass.
Parallelization: Single-threaded; owns shared policy semantics.
Blocked on: Nothing.

### S4 - Generate the deterministic Product Truth baseline

Status: done
Tier: T2
Type: ops
Actor/trigger: Developer runs a local audit command.
Action: Add a read-only CLI that renders JSON and Markdown from the discrepancy engine and commit the initial baseline audit.
Invariant protected: Running the audit cannot access or mutate live systems.
Intentional behaviour changes: Maintainers receive a reproducible inventory of current drift and remediation order.
Previous intended behaviours preserved: No source catalog is edited and no build/deploy hook runs the audit automatically.
Unsafe outcomes: CLI imports env-bearing clients; output contains secrets/credentials/customer records; timestamps make output nondeterministic; audit rewrites arbitrary paths.
Dependencies: S3.
Expected files: `tooling/audit-product-truth.ts`; `docs/audits/2026-08-04-product-truth-baseline.md`; optional JSON fixture under `docs/audits/` if useful.
Write boundaries: One tooling entry point and its explicit audit output path.
Tests required: CLI exits successfully; deterministic renderer test; output contains summary counts and all critical findings; no live dependency imports.
Runtime verification: Run locally twice and verify no diff on the second run.
Migration/backfill notes: None.
External docs needed: None.
Acceptance criteria: A future agent can reproduce the baseline from version-controlled sources only.
Exit evidence: `./node_modules/.bin/tsx tooling/audit-product-truth.ts` writes the Markdown and JSON baselines from 135 static records. Two consecutive runs produced Markdown SHA-256 `9cf0b38dbf8f2e12f20dda476f4f57bfa7bdcb648b8a5c629878024162960a6f` and JSON SHA-256 `c7029ba117fb7cf55845d95e8b6ed930a06d4c08bb92ed7472bbf35bc85c0235`. The focused suite passes 51 tests, including a real CLI process check; ESLint, TypeScript, and diff check pass.
Parallelization: Single-threaded because it writes the canonical baseline artifact.
Blocked on: Nothing.

### S5 - Add product-truth regression gates

Status: in_progress
Tier: T1
Type: verification
Actor/trigger: Test suite runs after any catalog or product metadata change.
Action: Add policies that prevent new unsafe drift while keeping current discrepancies explicit. Critical rules cover stable key uniqueness, blocked/internal products not being self-serve, service products not mapping to module entitlements, software-only positioning, sellable billable products having an approved billing path, and registry source references resolving.
Invariant protected: A metadata edit cannot silently change money/access semantics or introduce an unsupported sales claim.
Intentional behaviour changes: New product/catalog changes must update the registry and audit expectations together.
Previous intended behaviours preserved: Existing checkout/webhook behavior remains unchanged; known discrepancies are recorded, not silently grandfathered as correct.
Unsafe outcomes: Snapshot-only tests that approve arbitrary future drift; tests that force premature customer-facing alignment; a broad allowlist that suppresses severity.
Dependencies: S3 and S4.
Expected files: `__tests__/product-registry.test.ts`; `__tests__/product-truth-audit.test.ts`; narrow fixtures under `__tests__/fixtures/product-truth/` if necessary.
Write boundaries: Tests and explicit audit policy fixtures only.
Tests required: Mutation-style negative cases for each critical invariant; existing billing, marketplace, proposal, and Stripe idempotency tests.
Runtime verification: Not required.
Migration/backfill notes: None.
External docs needed: None.
Acceptance criteria: A new unsupported sellable product, entitlement mismatch, or service/software contradiction causes a clear failing test.
Exit evidence: Focused Vitest output and proof that existing billing/Stripe suites still pass.
Parallelization: Single-threaded due to shared expected findings.
Blocked on: Nothing.

### S6 - Verify and hand off Product Truth foundation

Status: pending
Tier: T1
Type: verification
Actor/trigger: Main agent completes the slice before product-source alignment begins.
Action: Run the repository checks, inspect the complete diff, confirm no runtime consumer changed, and record evidence in this plan.
Invariant protected: Phase A remains non-mutating and customer-invisible.
Intentional behaviour changes: None beyond internal registry/audit tooling and tests.
Previous intended behaviours preserved: Entire existing product and billing behavior.
Unsafe outcomes: Hidden source edits; `.env` or generated credentials staged; build output or audit artifacts containing customer data; claiming completion from partial checks.
Dependencies: S5.
Expected files: This plan's progress/evidence fields and implementation files from S0-S5.
Write boundaries: Verification notes only unless a failing check exposes an in-scope defect.
Tests required: Full Vitest suite; ESLint; `tsc --noEmit`; `git diff --check`; targeted import/source scan; relevant build if repository guidance requires it and environment permits.
Runtime verification: No browser proof required because no customer-visible consumer changes. Confirm audit CLI reproducibility instead.
Migration/backfill notes: Confirm no migration exists.
External docs needed: None.
Acceptance criteria: Checks pass; diff contains no runtime consumer switch, database call, Stripe call, env access, or customer-facing content edit.
Exit evidence: Exact command outputs, report checksum or clean regeneration, and final diff review.
Parallelization: Single-threaded final gate.
Blocked on: Nothing.

## Verification Gates

- **Automated checks:** Focused TDD per slice; existing billing-feature math; feature-Stripe idempotency; marketplace activation protections; proposal catalog tests where present; full Vitest; ESLint; TypeScript; diff check.
- **Runtime checks:** Run Product Truth CLI twice and prove deterministic output. Browser QA is intentionally unnecessary because no UI consumer changes.
- **Migration checks:** `git diff --name-only` must show no `prisma/schema.prisma` or `prisma/migrations/` change.
- **Security/auth checks:** Static import scan proves no audit path reaches Prisma, Stripe client, server actions, fetch, secrets, or environment values. Registry contains no customer identifiers.
- **Observability/audit checks:** Every discrepancy contains source, identifier, severity, reason, and remediation owner/category. Summary cannot report a clean state while critical findings exist.

## Subagent Plan

| Agent | Role | Slice(s) | Model/reasoning | Read scope | Write scope | Must not touch | Evidence required |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A1 | Billing/Stripe characterization reviewer | S0 | inherited / medium | Billing catalogs and existing tests | Test file only | Billing runtime, Stripe, DB | Stable-key and entitlement findings with file references. |
| A2 | Marketplace/proposal adapter implementer | S2 | inherited / medium | Marketplace/proposal catalogs and S1 types | Two adapter files and tests | Source catalogs, DB seed action | Deterministic normalized records and focused tests. |
| A3 | Billing/marketing adapter implementer | S2 | inherited / medium | Billing, feature pages, Terms, marketing copy | Disjoint adapter files and tests | Runtime consumers, Stripe sync | Deterministic normalized records and no-live-import proof. |
| Main | Contract, discrepancy policy, CLI, integration, final review | S1, S3-S6 | current | Approved design and all adapter outputs | Shared registry/audit/tooling/plan files | Live services and customer behavior | Full gates and final diff evidence. |

Agents must work in the dedicated product-design worktree, preserve nearby work, avoid reverting another worker, and stay inside their write boundaries. Git operations, generated report writes, full-suite checks, and final integration remain single-threaded.

## Blocked Decisions

None for Phase A. Customer-facing catalog corrections, prices, product activation rules, live Stripe reconciliation, and capability schema remain intentionally deferred to later approved slices.

## Update Rules

- Move only one slice to `in_progress` per worker unless the dependency graph explicitly allows parallel adapter work.
- Mark `done` only after exit evidence is recorded in the Progress table and slice section.
- Mark `blocked` with the exact missing decision, dependency, or failing check.
- Add newly discovered work as a new slice or follow-up; do not silently expand an active slice.
- Keep rejected, deferred, and known-drift items visible with their reason.
- Do not switch any runtime consumer to the registry during this plan.
- Do not run or modify Stripe, Neon, Vercel, or external integration state.

## Next Recommended Slice

Start S0 with failing characterization tests. Do not begin S1 until the current money/access behavior is locked by evidence.
