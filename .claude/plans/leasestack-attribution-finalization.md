# LeaseStack attribution finalization

Status: IN PROGRESS  
Owner: Codex  
Date: 2026-08-09  
Branch: `codex/leasestack-attribution-finalization`

## Outcome

Replace the separate Attribution and Reverse Attribution pages with one operator-facing proof screen that answers:

1. Which leads did LeaseStack capture?
2. Where did each lead come from?
3. Which captured leads can be credibly linked to an AppFolio application, resident, or signed lease?
4. Which possible matches need a person to confirm?
5. What data source proves every displayed stage and metric?

The pilot success criterion is a defensible Telegraph Commons list of LeaseStack-generated leads and signed outcomes, including a review queue for incomplete or changed contact data.

## Working brief

- Primary actors: authorized LeaseStack operators and property-restricted users.
- Core invariant: a signed lease is attributed to a LeaseStack lead only when a tenant-scoped, property-safe match has durable evidence; uncertainty is visible and never converted into a false ROI claim.
- Previous behavior preserved: AppFolio remains the source of truth; operator manual links/unlinks are sticky; LOST and UNQUALIFIED leads are never silently resurrected; existing lead source classification remains shared across forward and reverse calculations; property RBAC remains fail-closed.
- Unsafe outcomes: cross-tenant/cross-property matches, automatic weak-name matches, ambiguous candidates silently chosen, an AppFolio retry duplicating effects, sync failures hidden as zero, historical imports presented as LeaseStack-generated leads, or inferred stages presented as verified.
- Assumptions: a Resident row with an AppFolio lease is the strongest current signed-outcome evidence; Application rows remain the application-stage evidence; fuzzy identity evidence may nominate candidates but may auto-link only above a strict threshold with no close competitor.
- Out of scope for this finish: changing billing, deleting historical records, replacing AppFolio, or applying production migrations without the release gate.

## Current-state findings

- `Resident.leadId` is already the durable proof link.
- `lib/leads/lead-lease-link.ts` already matches exact normalized email, phone, then exact full name; it aborts ambiguity and protects cross-property phone/name matches.
- The AppFolio resident sync promotes linked leads monotonically to SIGNED and preserves manual link/unlink decisions.
- No match confidence, match method metadata, unmatched state, or append-only decision log exists.
- Attribution and Reverse Attribution share source classification but still render as two separate navigation/pages.
- `lib/reports/lead-journey.ts` already computes an honest cohort funnel with tracked/untracked stages and PMS evidence; reuse it.
- AppFolio has bounded retries for 429/5xx, timeout budgets, cursor recovery, phase failure state, status banners, and manual retry. Initial report 404s are currently treated as plan limitations and intentionally not retried.
- The reported property-level GA4 false-negative was already fixed on current main by accepting property-specific or org-wide integration rows.
- Segment sync still rewrites `Visitor.lastSeenAt` after six hours without proof of a new visit. That remains a real attribution-window bug.
- The Crisp knowledge base already rejects the PMS identity error but still makes unsupported availability-grounding claims and needs a hard rule against declaring a term/property fully leased without current property data.

## Data model

### `LeadMatchDecision` (new, append-only audit table)

- `id`, `orgId`, `propertyId`
- `residentId` (nullable relation for signed/resident outcomes)
- `applicationId` (nullable relation for application outcomes)
- `leadId` (nullable candidate/chosen lead)
- `status`: `MATCHED`, `UNMATCHED`, `AMBIGUOUS`, `REJECTED`, `MANUAL_MATCH`, `MANUAL_UNLINK`
- `method`: `EXACT_EMAIL`, `NORMALIZED_EMAIL`, `EXACT_PHONE`, `NORMALIZED_PHONE`, `NAME_PHONE`, `NAME_EMAIL`, `FUZZY_COMPOSITE`, `MANUAL`, `NONE`
- `confidence` integer 0–100
- `evidence` JSON containing only normalized comparison facts/reasons, not secrets
- `syncRunId` nullable correlation string
- `reviewedByUserId`, `reviewedAt`, `createdAt`
- indexes on `(orgId, status, createdAt)`, `(residentId, createdAt)`, `(leadId, createdAt)`

The table records every decision attempt. It does not replace `Resident.leadId`, which remains the current proof link.

### `AppFolioSyncRun` and `AppFolioSyncPhaseLog` (new)

- Run: org, start/completion timestamps, status, attempt, counts, next retry time, top-level error.
- Phase log: run, phase/report, status, attempt, HTTP status, row count, duration, error, raw response JSON.
- Raw payload storage must be bounded per page and retention-aware because AppFolio payloads contain PII. Never render raw payloads to tenant users; admin/debug access only.
- `AppFolioIntegration` gains consecutive failure count and last successful sync timestamp only if current `lastSyncStats` cannot safely supply them.

### Visitor sync timestamp

- Add `Visitor.lastEnrichedAt` (nullable) for segment reconciliation.
- Segment sync updates `lastEnrichedAt`, never `lastSeenAt`.
- Real webhook/pixel events remain the only writers that advance `lastSeenAt`.

All migrations are handwritten Prisma migrations. Never run `prisma migrate dev` or `prisma db push`; `.env.local` points at production.

## Matching architecture

### Candidate generation

Candidate reads are always constrained by `orgId` and property rules before scoring. Generate candidates from:

1. normalized phone
2. normalized email
3. exact/reversed normalized full name plus phone/email evidence
4. bounded fuzzy email/name candidates within the same tenant and compatible property

### Normalization

- Phone: digits only, last ten digits when valid; reject partials.
- Email: trim/lowercase; preserve exact normalized address; compute local/domain typo distance separately.
- Name: Unicode fold, punctuation/whitespace normalization, first/last reversal, missing-last handling, and an explicit small nickname alias map.
- Never use a name-only fuzzy match as automatic proof.

### Scoring and decisions

- 100: normalized phone + normalized email agree.
- 98: exact normalized email plus compatible property/name evidence.
- 95: unique exact normalized email.
- 92: unique normalized phone on the same property (or org-wide captured lead).
- 85–91: corroborated fuzzy/composite candidate; review required unless policy tests prove a safe automatic threshold.
- below 85 or close competing candidate: unmatched/ambiguous review queue.

An automatic match requires one candidate above the auto threshold and a safe margin over the runner-up. Ambiguity aborts. Existing/manual links remain first-write-wins. Every outcome appends `LeadMatchDecision`.

### Stage reconciliation

- Application status promotes only forward: submitted/under-review → APPLIED, approved → APPROVED.
- Resident plus lease evidence promotes eligible leads to SIGNED.
- LOST/UNQUALIFIED are never auto-promoted.
- Converted timestamps use the best source timestamp (application received, lease start/move-in), never sync time when real evidence exists.

## Unified attribution screen

Route: `/portal/attribution`.  
`/portal/reverse-attribution` becomes a redirect preserving date/property query parameters. Remove Reverse Attribution from all navigation and command surfaces.

### Header and filters

- 7/30/60/90-day ranges
- property filter constrained by visible ACTIVE properties
- source filter: chatbot, popup/form, pixel, Google Ads, Meta Ads, organic, direct, referral, imported/AppFolio
- CSV export using the same server-side filter and RBAC clause
- AppFolio health: last successful sync, failure state, next retry/manual retry

### Proof funnel

Use one cohort and verified evidence:

`First touch → Lead captured → Enriched → Contacted → Tour scheduled → Toured → Applied → Approved → Signed`

- A stage with no live data source is labeled `Not tracked`, not zero.
- Every count exposes provenance and its exact date window.
- Imported AppFolio history is visually separate from LeaseStack-generated leads.
- Top-line ROI centers on verified signed matches and shows unverified candidates separately.

### Lead proof table

Each row includes source, first touch, capture surface, captured identity, property, current stage, outcome evidence, match method/confidence, verification state, and timestamps. States:

- Verified — durable PMS match
- Review needed — plausible candidate(s)
- LeaseStack only — no PMS outcome yet
- Imported — originated in PMS, not claimed as LeaseStack-generated

### Review queue

- Side-by-side captured lead and AppFolio resident/application identity.
- Confirm, reject, or unlink through the existing tenant-scoped manual-link invariant.
- Every manual decision creates an audit event and `LeadMatchDecision` row.
- No bulk auto-confirm action.

## AppFolio hardening

- Keep no-retry behavior for a confirmed unsupported initial 404; retrying a missing report cannot recover it.
- Retry timeouts and transient 404s only when evidence distinguishes gateway/cursor failure from unsupported report behavior.
- Use bounded exponential backoff with jitter and the serverless wall-clock budget.
- Persist every phase attempt in sync run/phase logs.
- Surface consecutive failures and the next retry time.
- Alert after the configured consecutive-failure threshold; never silently turn failure into zero.
- Preserve idempotent upserts and existing phase recovery.

## Migration and release

1. Confirm whether `20260804_add_appfolio_backfill_requested_at` is applied in production.
2. Re-review the existing activation/backfill defects before deploying any schema-dependent code.
3. Add the attribution audit/sync-log/visitor migrations as additive nullable changes.
4. Deploy migrations before code that selects new columns/tables.
5. Run a dry-run matching report for Telegraph Commons/SG; do not write links.
6. Review ambiguous and false-positive samples.
7. Enable automatic high-confidence matching only after the dry-run evidence passes.
8. Use `dual-review` for the Tier-1 link/state transition slice and `cap` to ship.

## Test plan

### Unit

- Phone/email/name normalization including reversed names, missing last names, nicknames, Unicode, typos, and invalid partials.
- Score thresholds, runner-up margin, ambiguity abort, cross-property rejection, and no name-only auto-match.
- Monotonic stage promotion and real evidence timestamps.
- Provenance label derivation.

### Integration

- AppFolio resident/application sync appends matched/unmatched/ambiguous decisions.
- Retry/idempotency produces no duplicate proof links or duplicate current state.
- Manual unlink remains sticky across later syncs.
- Wrong-org and wrong-property candidates are impossible.
- External failure is visible and phase logs persist.
- Segment sync updates `lastEnrichedAt` without changing `lastSeenAt`.
- CSV export enforces the same filters/RBAC as the page.

### E2E/runtime

- One attribution nav item; reverse URL redirects.
- Filter 7/30/60/90 days, property, and source.
- Open a review candidate, confirm/reject, and see the row/proof count change.
- Export CSV and verify visible rows/provenance match the selected view.
- Exercise zero-data, AppFolio-unavailable, partial-sync, unmatched, and verified states.
- Desktop and mobile visual verification against the approved portal patterns.

## Slice dependency graph and progress

| Slice | Depends on | Risk | Status |
|---|---|---:|---|
| 0. Safe baseline, main merge, migration/read-only reality check | — | Tier 1 | done (production migration status still recheck before release) |
| 1. Matching policy + audit schema + failing tests | 0 | Tier 1 | done (resident auto-match and manual decisions are append-only and atomic) |
| 2. Sync integration + phase logs/health | 1 | Tier 2 | done (existing retry/phase health retained; match writes made atomic) |
| 3. Unified query/provenance/export layer | 1–2 | Tier 1 | done |
| 4. Unified UI + review queue + reverse redirect/nav removal | 3 | Tier 1/3 | done |
| 5. Visitor timestamp and Crisp truth fixes | 0 | Tier 2/3 | done (separate enrichment timestamp; existing hard availability guard verified) |
| 6. Dry-run migration/backfill and Telegraph validation | 1–5 | Tier 1 | blocked pending verified code + explicit production-write approval |
| 7. Full checks, runtime verification, dual review, ship | 1–6 | Tier 1 | shipping (82 focused tests, lint, type-check, and compile passed; user waived further local runtime checks) |

## Slice 1 write boundary

- `prisma/schema.prisma`
- new handwritten migration(s)
- `lib/leads/lead-lease-link.ts` and focused matching modules
- AppFolio resident/application match call sites only
- focused tests

Acceptance evidence: tests fail before implementation; exact current matches remain unchanged; weak/ambiguous candidates become review records rather than false links; wrong-org/property and operator-unlink cases stay protected.
