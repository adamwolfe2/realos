# Capability Readiness Control Center Thin Slice Plan

Status: COMPLETE — AUTHENTICATED VISUAL QA PENDING
Last updated: 2026-08-04
Owner: Codex

## Working Brief

- **Feature:** Canonical derived capability profiles and a read-only agency Activation control center.
- **Actors:** LeaseStack agency owner, admin, and operator.
- **Invariant:** Customer readiness is proven by correctly scoped operational evidence, never by access flags or configuration alone.
- **Previous behavior:** Current dashboard, setup, onboarding, launch checklist, integration, billing, and entitlement behavior remains unchanged.
- **Unsafe outcomes:** Cross-tenant evidence; broad `AL_PARTNER` access; false-ready states; swallowed loader errors; PII/raw-error leakage; N+1 property queries; live mutations.
- **Evidence:** Approved parent design; Phase A product registry; existing `lib/properties/launch.ts`, `lib/setup/*`, `lib/onboarding/*`, `lib/admin/data-sinks*`, and admin client detail UI.
- **Assumptions:** A derived read model is the safest reversible foundation. Durable activation proof will be a later separately approved migration slice.
- **Out of scope:** Writes, overrides, migrations, external calls, entitlement/pricing/Stripe changes, broad auth remediation, customer dashboard edits.

## Risk Classification

- **Overall:** Tier 1 because this is cross-tenant admin data and future activation authority.
- **Current live-data risk:** Read-only database queries only; no external reads required.
- **Migration risk:** None.
- **Authorization:** Explicit staff-read allowlist; route reloads the target as a CLIENT organization.

## Dependency Graph

`S0 -> S1 -> S2 -> S3 -> S4 -> S5`

## Progress

| Slice | Status | Exit evidence |
| --- | --- | --- |
| S0 Characterize current contracts | done | Repository and three specialist reviews completed; no edits. |
| S1 Pure capability evaluator | done | RED: missing capability modules. GREEN: capability + registry suites pass 28 tests; ESLint, TypeScript, and forbidden-import scan pass. |
| S2 Strict tenant snapshot loader | done | Two fixed Prisma reads regardless of property count; 15 focused loader tests pass. |
| S3 Admin Activation route | done | Staff-read role matrix and page/navigation suites pass 13 tests; combined Phase B suite passes 48. |
| S4 Runtime and regression verification | done | 2,015 tests, TypeScript, ESLint, product audit, production build, and route compilation pass. Local visual QA reached the expected sign-in wall; production-only Clerk keys reject localhost, so authenticated visual QA is explicitly pending. |
| S5 Independent review and checkpoint | done | Independent Tier-1 review found three high false-ready risks; all were fixed and re-reviewed with no critical/high findings remaining. Explicit local checkpoint only; no push or deploy. |

## S0 - Characterize current contracts

Tier: T1
Actor/trigger: Developer begins Phase B.
Action: Map registry, setup, launch, sync, auth, and admin UI contracts before designing the new read model.
Invariant: Existing overlapping readiness systems are reused as evidence and not silently replaced.
Exit evidence: Reviews identified `lib/properties/launch.ts` as the strongest existing proof pattern; confirmed module flags are entitlements only; found broad `requireAgency()` access; selected an isolated read-only admin surface; no files changed.

## S1 - Pure capability evaluator

Status: done
Tier: T1
Actor/trigger: A capability contract is evaluated for an organization or exact property.
Action: Add typed subjects, signals, evidence, requirements, checks, blockers, profiles, product contracts, and deterministic evaluator functions.
Invariant: Foreign or sibling scope never contributes; readiness requires evidence; raw errors and PII cannot enter output types.
Intentional changes: Introduce one canonical vocabulary for derived customer readiness.
Previous behavior preserved: Product registry and all runtime consumers remain unchanged.
Unsafe outcomes: Entitlement-only ready; implicit null-property fan-out; non-deterministic status; duplicate/unsafe blocker messages.
Expected files: `lib/products/capabilities/{types,contracts,evaluate}.ts`; focused tests.
Tests: RED first for scope, any/all, stale/error, unsupported/degraded, evidence, deterministic ordering, and eight contract keys.
Runtime verification: Not required for pure domain logic.
Acceptance: Focused tests pass with no server-only, Prisma, fetch, env, or external imports.
Exit evidence: 18 evaluator tests and 10 registry tests pass. Scope rejection, explicit org-wide allowance, any/all semantics, lifecycle precedence, degraded lanes, typed evidence, injected-clock expiry, and deterministic blockers are covered. ESLint and `tsc --noEmit` pass.

## S2 - Strict tenant snapshot loader

Status: done
Tier: T1
Actor/trigger: Authorized agency staff opens one client's Activation route.
Action: Load existing client/property/integration/outcome evidence with fixed-count, strict Prisma reads and translate it into typed safe signals and profiles.
Invariant: Every row is constrained to the requested CLIENT org; property evidence has matching `orgId`; loader failures throw rather than become disconnected.
Intentional changes: Agency staff can inspect derived readiness; no state changes.
Previous behavior preserved: Existing sync/status helpers and data stay untouched.
Unsafe outcomes: N+1 queries; raw provider errors; stale green state; org-wide evidence proving every property; live external call.
Expected files: `lib/admin/client-activation.ts`; adapter tests with mocked Prisma boundary.
Tests: Foreign org/property rejection, loader error, zero/single/50 properties, stale timestamps, exact property coverage, no external calls.
Acceptance: Query count is fixed with portfolio size and all output is user-safe.
Exit evidence: Loader uses one strict nested organization snapshot and one exact-lead notification query for zero, one, or fifty properties. Fifteen tests cover null/non-client targets, foreign org/property data, DB failure propagation, fixed query count, exact property-and-lead chatbot proof, entitlement separation, stale/error aggregation, generic-report rejection, canonical ordering, and PII/raw-error/id omission.

## S3 - Admin Activation route

Status: done
Tier: T1/T3
Actor/trigger: Staff selects Activation for a client.
Action: Add an explicit staff-read guard, isolated route, navigation link, and dense responsive product table.
Invariant: Only agency owner/admin/operator can view; AL Partner and client roles fail closed.
Intentional changes: New admin-only read surface.
Previous behavior preserved: Existing client tabs and customer dashboard remain visually and behaviorally unchanged.
Unsafe outcomes: Broad admin access; missing empty/error states; color-only statuses; mobile overflow; mutation control accidentally added.
Expected files: `lib/tenancy/scope.ts`; focused auth test; `app/admin/clients/[id]/activation/*`; narrow client navigation edit.
Tests: Role matrix, canonical eight rows, semantic headings/table, safe proof/blocker copy, navigation contract.
Runtime verification: Desktop and mobile local browser session with representative fixture/client.
Acceptance: All states are labelled in text; focus works; no console/page errors or horizontal document overflow.
Exit evidence: Nine role tests and four server-rendered page/navigation tests pass. Route authorization runs before loading; missing clients 404; data/scope failures reach the error boundary; Activation is isolated from query-tab parsing; all actions remain read-only agency links. Browser evidence remains in S4.

## S4 - Runtime and regression verification

Status: done
Tier: T1
Action: Run focused/full tests, fresh TypeScript/build gates, ESLint, diff/security scans, and browser checks.
Acceptance evidence: No schema/migration/env/Stripe/external mutation and no customer dashboard files changed. Full suite passes 185 files/2,015 tests; fresh production build includes `/admin/clients/[id]/activation`; TypeScript, targeted ESLint, product-truth audit, and diff checks pass. Browser reached the normal sign-in wall, but authenticated viewport QA requires Clerk development keys or a safe preview on an allowed Clerk domain.

## S5 - Independent review and checkpoint

Status: done
Tier: T1
Action: Review tenant scope, auth, false-ready semantics, query scaling, and UI preservation; remediate confirmed findings; create local checkpoint only.
Acceptance evidence: Independent review confirmed exact tenant/property scoping and remediated three false-ready paths: unrelated chatbot notification joins, generic reports as Monday Brief proof, and healthy properties hiding stale/error siblings. It also required durable origin and truth-test proof before chatbot readiness. No critical/high findings remain. No push/deploy.

## Deferred Findings

- Broader `requireAgency()` grants `AL_PARTNER` general agency access and protects several mutation surfaces too broadly. This is a separate urgent auth-hardening slice because changing it globally could break Audience Sync behavior.
- Some existing setup/readiness helpers treat row existence or org-wide signals as completion and swallow database errors. They remain evidence sources only, not activation authority.
- Durable activation proof, override reasons, audit history, and state transitions require a later migration/write slice with transaction and idempotency design.
