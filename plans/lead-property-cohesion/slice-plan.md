# Lead and Property Cohesion Thin Slice Plan

Status: COMPLETE
Last updated: 2026-08-10
Owner: Codex

## Working Brief

- Feature or fix: Normalize missing lead display names and modernize the property detail interface.
- Primary actors: LeaseStack operators viewing leads, attribution, and property details.
- Core invariant: Presentation may improve, but stored identity, attribution, authorization, integrations, and property data behavior must remain unchanged.
- Previous intended behaviours: Captured names win; attribution uses verified evidence; property tabs and deep links remain reachable; image editing and sparse-property states remain functional.
- Unsafe outcomes: Persisting guessed names, using inferred names for matching or outreach, dropping a property capability, changing tenant/property scope, or inventing metrics.
- Current evidence: Approved design specs; `lib/attribution/proof.ts`; current portal lead renderers; `app/portal/properties/[id]/page.tsx`; `property-hero-banner.tsx`; `property-intelligence-panel.tsx`; `property-tabs.tsx`; `tabs/overview.tsx`.
- Assumptions: Email inference is display-only; alphabetic local parts are acceptable as a single title-cased label; current portal tokens are the visual source of truth.
- Out of scope: Schema changes, backfills, AI inference, lead matching, deduplication, notifications, outbound personalization, recommendation logic, billing, integration behavior, and new property data.

## Risk Classification

- Overall tier: Tier 3
- Why: Display formatting and UI layout only.
- Live-data risk: None; no writes or backfills.
- Migration risk: None.
- External-contract risk: None.

## Dependency Graph

| Node | Depends on | Parallel? | Shared-state risk | Notes |
| --- | --- | --- | --- | --- |
| S1 | None | No | Shared formatter consumers | Establish identity contract first |
| S2 | S1 | No | Multiple lead renderers | Adopt formatter without changing queries |
| S3 | None | No | Property header component | Compact identity and KPI hierarchy |
| S4 | S3 | No | Property page composition | Compact action queue |
| S5 | S3 | No | URL-driven tab state | Group navigation, preserve keys |
| S6 | S4, S5 | No | Overview composition | Align final dashboard layout |
| S7 | S2, S6 | No | Git and verification | Final focused checks and ship |

## Progress

| Slice | Status | Tier | Owner | Evidence | Next gate |
| --- | --- | --- | --- | --- | --- |
| S1 | done | T3 | Codex | `lead-display-name.test.ts`, 11 passing cases | adopt formatter |
| S2 | done | T3 | Codex | attribution and primary lead surfaces use shared formatter | property UI |
| S3 | done | T3 | Codex | compact header structural test passes | action queue |
| S4 | done | T3 | Codex | three-item queue structural test passes | grouped tabs |
| S5 | done | T3 | Codex | four-group mapping structural test passes | overview |
| S6 | done | T3 | Codex | balanced overview structural test passes | final checks |
| S7 | done | T3 | Codex | 23 focused tests, TypeScript, ESLint, and diff checks pass | ship |

## Slices

### S1 - Shared display-name formatter

Status: pending
Tier: T3
Type: frontend/domain utility
Actor/trigger: Any operator-facing renderer receives a lead identity.
Action: Return stored names first, then a conservative email-derived label, then email, then "Unidentified lead".
Invariant protected: Inference is pure presentation and never mutates lead data.
Intentional behaviour changes: Operator-facing labels stop using "Unknown lead" when email identity exists.
Previous intended behaviours preserved: Partial or complete stored names remain authoritative.
Unsafe outcomes: Treating role/numeric mailboxes as person names or exporting inferred names as stored facts.
Dependencies: None.
Expected files: `lib/leads/display-name.ts`, focused unit test.
Tests required: Stored/partial names, separated local parts, alphabetic local part, role mailbox, numeric local part, missing email.
Runtime verification: Not required; pure deterministic utility.
Acceptance criteria: All formatter cases match the approved design.
Exit evidence: Focused unit tests pass.

### S2 - Normalize operator-facing lead labels

Status: pending
Tier: T3
Type: frontend integration
Actor/trigger: Operator opens attribution, leads, property activity, search, applications, tours, or a lead detail view.
Action: Replace local fallback logic with the shared formatter where a lead email is available.
Invariant protected: Queries, matching, exports, and stored fields remain unchanged.
Intentional behaviour changes: Consistent display labels across primary operator lead surfaces.
Previous intended behaviours preserved: Existing email fallbacks remain readable; captured names win.
Unsafe outcomes: Using inferred names in notifications, matching, personalization, or resident identity.
Dependencies: S1.
Expected files: `lib/attribution/proof.ts` and bounded portal lead renderers with email already selected.
Tests required: Attribution regression plus source-level assertions that shared formatting is used.
Runtime verification: Not required by user; static and unit verification is sufficient.
Acceptance criteria: No primary lead surface renders "Unknown lead" when an email is present.
Exit evidence: Focused tests and TypeScript pass.

### S3 - Compact property identity and KPI header

Status: pending
Tier: T3
Type: frontend
Actor/trigger: Operator opens `/portal/properties/[id]`.
Action: Replace the oversized hero composition with a compact identity row and four concise KPI cards while preserving image controls.
Invariant protected: Existing property data and image APIs remain unchanged.
Intentional behaviour changes: Reduced height, stronger hierarchy, current portal styling.
Previous intended behaviours preserved: Property photo, title, address, metrics, snapshot link, upload, removal, and repositioning.
Unsafe outcomes: Hiding image controls or fabricating unavailable KPIs.
Dependencies: None.
Expected files: `property-hero-banner.tsx`, `app/portal/properties/[id]/page.tsx`, focused structural test.
Tests required: Compact structure and absence of obsolete oversized layout classes/copy.
Runtime verification: Not required by user; component structure and types.
Acceptance criteria: Identity and KPI strip occupy a compact top section.
Exit evidence: Focused test and TypeScript pass.

### S4 - Compact property action queue

Status: pending
Tier: T3
Type: frontend
Actor/trigger: Property recommendations resolve.
Action: Restyle the intelligence panel as a compact ranked queue with restrained severity badges and one clear action per row.
Invariant protected: Recommendation generation, order, hrefs, and labels do not change.
Intentional behaviour changes: Intelligence no longer dominates the page.
Previous intended behaviours preserved: Empty and populated states, priority counts, and actions.
Unsafe outcomes: Dropping recommendations or changing their priority.
Dependencies: S3.
Expected files: `property-intelligence-panel.tsx`, page composition test.
Tests required: Queue structure, action preservation, no oversized presentation.
Runtime verification: Not required by user.
Acceptance criteria: Queue is compact and scannable.
Exit evidence: Focused test and TypeScript pass.

### S5 - Group property navigation

Status: pending
Tier: T3
Type: frontend
Actor/trigger: Operator navigates property sections.
Action: Group current tabs under Overview, Marketing, Leasing, and Operations with a compact secondary row.
Invariant protected: Every existing tab key and `?tab=` deep link resolves to the same panel.
Intentional behaviour changes: Navigation hierarchy becomes grouped and easier to scan.
Previous intended behaviours preserved: Ads and occupancy visibility gates; URL-driven state; horizontally scrollable narrow layout.
Unsafe outcomes: Orphaned tabs, changed URLs, hidden active state, or inaccessible controls.
Dependencies: S3.
Expected files: `app/portal/properties/[id]/property-tabs.tsx`, focused navigation test.
Tests required: Complete tab-to-group mapping, gate behavior, and current deep-link handling.
Runtime verification: Not required by user.
Acceptance criteria: Four groups expose every currently available panel.
Exit evidence: Focused test and TypeScript pass.

### S6 - Align overview dashboard layout

Status: pending
Tier: T3
Type: frontend
Actor/trigger: Operator views the property Overview tab.
Action: Tighten the existing two-column composition and align cards, spacing, badges, and hierarchy with the current portal.
Invariant protected: Existing queries, sparse-property path, integration states, details, and editors remain intact.
Intentional behaviour changes: Cleaner primary/secondary hierarchy and less visual noise.
Previous intended behaviours preserved: Marketing pipeline, activity, integrations, property facts, listing summary, and attributes.
Unsafe outcomes: Removing an editor or misrepresenting an integration state.
Dependencies: S4 and S5.
Expected files: `tabs/overview.tsx` and existing overview presentation components only.
Tests required: Structural assertions for the two-column hierarchy and preserved components.
Runtime verification: Not required by user.
Acceptance criteria: Overview visually matches the refreshed portal without feature loss.
Exit evidence: Focused test and TypeScript pass.

### S7 - Final verification and ship

Status: pending
Tier: T3
Type: verification
Actor/trigger: All presentation slices are complete.
Action: Run focused tests, TypeScript, lint on changed files, diff checks, and push once to main.
Invariant protected: Only approved files are committed; unrelated `plans/correctness-first-takeover/` remains untouched.
Dependencies: S2 and S6.
Expected files: No new product scope.
Tests required: Focused suites for names, attribution, property UI, then TypeScript and lint.
Runtime verification: Omitted at the user's explicit request.
Acceptance criteria: Checks pass and main receives one implementation commit.
Exit evidence: Command output and successful push.

## Verification Gates

- Automated checks: Focused Vitest suites, `tsc --noEmit`, ESLint on changed files, `git diff --check`.
- Runtime checks: Omitted by explicit user direction.
- Migration checks: Not applicable.
- Security/auth checks: Confirm property page retains `requireScope`, `tenantWhere`, and allowed-property gate unchanged.
- Observability/audit checks: Not applicable; no writes.

## Update Rules

- Move one slice at a time to `in_progress`, then record evidence before marking it done.
- Add discovered work as a new slice rather than expanding the active slice silently.
- Keep unrelated untracked work untouched.
