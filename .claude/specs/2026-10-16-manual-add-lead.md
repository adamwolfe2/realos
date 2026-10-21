# F-015 Manual "Add lead" form (plan only, safe-feature-slice)

Status: PLAN. No application code in this PR. Tier-1 (lead capture + lead-notify) so build via `safe-feature-slice`.
Verified against origin/main `5e6e20a7` on 2026-10-16.

## Goal
- Walk-in, phone and ILS leads get an in-portal entry path: button on `/portal/leads` -> `/portal/leads/new` -> form -> new `Lead` (source MANUAL/OTHER, status NEW) -> operator email.
- Fills the empty lead-to-lease funnel for operators without AppFolio (PRODUCT.md problem #3).

## Non-goals
- No CSV import, no bulk add, no edit/merge of existing leads, no lead assignment UI.
- No change to `GET/POST /api/tenant/leads` behavior (see Open Questions), no public capture changes.
- No schema/migration. No chatbot, Funnel, or cadence changes.
- Not fixing `createManualApplication`'s lead lookup (plain `email:` equality, case-sensitive, not via find-by-email). Separate follow-up.

## Verified facts (all confirmed in code)
- `POST /api/tenant/leads` exists (`app/api/tenant/leads/route.ts`), no UI caller. It has NO dedupe (always `lead.create`) and no rate limit, so it cannot be the UI backend as-is.
- `enum LeadSource` (prisma/schema.prisma:169) already has MANUAL and OTHER. `LeadNotifyChannel` already has MANUAL; `Organization.notifyOnManualLead` exists. No migration.
- `Lead.email` is nullable with NO unique constraint (only `@@unique([orgId, externalSystem, externalId])`), so dedupe is app-level and races on concurrent submits (same accepted ceiling as `app/api/public/leads/route.ts`).
- `gateManualWrite` in `lib/actions/manual-records.ts` is unexported and requires `moduleResidents`. Leads are not part of that module, so do NOT reuse it or put the action in that file.
- `app/portal/leads/page.tsx` uses only `requireScope()`; no module gate. Header `actions` slot (line ~401) is where the button goes.

## Files
Add:
- `lib/actions/manual-leads.ts` ("use server"): `createManualLead(raw: unknown): Promise<ManualLeadResult>`. Only async function exports plus `export type` (types are erased; any non-async value export breaks only `next build`). Keep the zod schema and helpers non-exported.
- `app/portal/leads/new/page.tsx`: server page. `requireScope()`; redirect to `/portal/leads` unless `ALLOWED_WRITE_ROLES.has(scope.role)`; properties via `prisma.property.findMany({ where: { ...marketablePropertyWhere(scope.orgId), ...(scope.allowedPropertyIds ? { id: { in: scope.allowedPropertyIds } } : {}) } })` (copy of `applications/new/page.tsx`, minus `requireModule`). `export const dynamic = "force-dynamic"`.
- `components/portal/add-lead-form.tsx` ("use client"): `AddLeadForm`. Put here, not in `manual-entry-forms.tsx` (its helpers `Field`, `FormShell`, `useManualSubmit`, `inputCls` are file-local and that file imports residents-only actions). Either export the helpers from `manual-entry-forms.tsx` (preferred, one-line `export` each) or copy them; do not re-style.
- `__tests__/manual-lead-action.test.ts` (see Test plan).
Change:
- `app/portal/leads/page.tsx`: add a "Add lead" `Link` (Lucide `Plus` icon) in the header `actions`, rendered only when `ALLOWED_WRITE_ROLES.has(scope.role)`. Same classes as the "Log application" link.
- `__tests__/lead-notify-after.test.ts`: add `lib/actions/manual-leads.ts` to `LEAD_NOTIFY_FILES` (source guard against bare `void notify`).

## Invariants
1. Writable-workspace guard. First line of the action: `requireWritableWorkspace()` (`lib/tenancy/scope.ts:530`). It calls `requireScope()`, rejects roles outside `ALLOWED_WRITE_ROLES` (`lib/auth/write-roles.ts`; CLIENT_VIEWER is read-only), and throws `TrialExpiredError` (a `ForbiddenError`) on a lapsed trial unless impersonating. Catch `ForbiddenError` and return `{ ok:false, error: err.message }`; rethrow anything else (pattern `fail()` in manual-records.ts). Also `checkRateLimit(clientWriteLimiter, "manual-lead:"+scope.userId)` (20/min).
2. Property scoping. `propertyId` REQUIRED (so a restricted agent can always see the lead they create; null-property leads vanish from scoped users' lists). Check `propertyInScope(scope, propertyId)` (`scope.ts:580`, honors `allowedPropertyIds`) AND `prisma.property.findFirst({ where: { id, ...marketablePropertyWhere(scope.orgId) } })`. Failure returns "Property not found." (do not distinguish cross-tenant from out-of-grant). Never read `orgId` from client input; use `scope.orgId`. Audit via `auditPayload(scope, ...)`.
3. Dedupe by email. Normalize with `normalizeLeadEmail`; look up ONLY with `findOldestLeadByEmail(scope.orgId, email, { id:true, propertyId:true })` (`lib/leads/find-by-email.ts`; escapes `_ % \` so ILIKE is exact). Never `mode:"insensitive"` inline. Store the normalized lowercase email. On a hit: no create, no notify, no audit row; return `{ ok:false, duplicate:true, error:"A lead with this email already exists.", leadId }`, with `leadId` included ONLY if `propertyInScope(scope, existing.propertyId)` (else no link, avoids leaking another building's lead). No email provided = no dedupe (phone-only walk-ins are legal), but require at least one of email or phone.
4. Exactly one notify per created lead, zero on dedupe. Path: `notifyLeadCaptured` (`lib/notifications/lead-notify.ts:73`) is never throwing (outer try/catch), called via `runAfter("manual-leads.notify", ...)` (`lib/after.ts`: `after()` with inline fallback, logs + Sentry on failure). Single call site, placed after `lead.create` succeeds and the dedupe branch returns early. Channel `LeadNotifyChannel.MANUAL`; recipients = property `notifyLeadEmailOverride` ?? org `notifyLeadEmail`; honors `notifyOnManualLead` (SUPPRESSED delivery row when off or no recipient). Non-CHATBOT channel also fires `pushLeadToFunnel` (fail-soft, no-op if Funnel not connected): intended, mention in PR. Notify is not retried; a double submit is stopped by the dedupe and the pending-transition disabling the button.
5. No migration. `git diff origin/main -- prisma/` must be empty.
6. UI: light only, Lucide icons only (`Plus`, `UserPlus`), no emojis. Copy says "track" not "manage": page title "Add lead", description "Add a walk-in, phone or listing-site inquiry so you can track it from first contact to lease." Never "manage".
7. No swallowed errors: the audit write logs on failure (`.catch(err => console.error("[manual-lead] audit failed", err))`), not a bare `.catch(() => undefined)` as in manual-records.ts. Return user-safe strings; never echo Prisma errors.
8. Source field: select of MANUAL ("Walk-in / phone"), REFERRAL, OTHER, plus free text `sourceDetail` (e.g. "Apartments.com"). Limit the zod enum to these three, not all `LeadSource`, so operators cannot mint fake CHATBOT/GOOGLE_ADS attribution.

## Failure modes
- Duplicate email: friendly error + link to existing lead (when in scope). No writes.
- Concurrent submit with same email: both pass the lookup and two leads exist (accepted race; partial unique index on `(orgId, lower(email))` would need a migration, out of scope).
- Property archived/IMPORTED between page load and submit: "Property not found."
- Trial expired / viewer role: error string, no write, no notify.
- Notify fails (Resend down, no recipient, toggle off): lead is saved; failure logged/SUPPRESSED row. Form still succeeds.
- Rate limit exceeded: "Too many entries, try again in a minute."
- `lead.create` throws: rethrow after log; client shows generic "Something went wrong" (via `useManualSubmit` catch). No audit row, no notify.
- Server-action non-async export (build-only failure): covered by the `next build` check.

## Test plan (vitest, mocks like `lead-notify-after.test.ts`)
`__tests__/manual-lead-action.test.ts`:
- Rejects when `requireWritableWorkspace` throws ForbiddenError (viewer, trial expired): no `lead.create`, no notify.
- Out-of-grant property (`allowedPropertyIds` excludes it) and cross-tenant property: "Property not found.", no create.
- Requires email or phone; invalid email rejected; source outside MANUAL/REFERRAL/OTHER rejected.
- Happy path: creates with `orgId: scope.orgId`, lowercased email, status default, `LeadSource.MANUAL`; audit row; `notifyLeadCaptured` called exactly once with channel MANUAL and the new leadId.
- Dedupe: `findOldestLeadByEmail` returns a row -> no `lead.create`, `notifyLeadCaptured` not called, returns `duplicate:true`; `leadId` omitted when existing lead's property is out of scope.
- Uses `findOldestLeadByEmail` (assert called with `scope.orgId`) and source contains no `mode: "insensitive"`.
- Source guard: file added to `LEAD_NOTIFY_FILES` in `lead-notify-after.test.ts`.
Tenancy lint (`__tests__/tenancy-lint.test.ts`): globs `lib/actions/**` and `app/portal/**/page.tsx`, so both new files are scanned automatically. Each must mention a sanctioned helper or `scope.orgId`/`scope.allowedPropertyIds`. Action satisfies it via `propertyInScope`, `marketablePropertyWhere`, `scope.orgId`; the new page via `marketablePropertyWhere` + `scope.allowedPropertyIds`. No ALLOWLIST entry should be added; if lint fails, fix the file, not the list. The `lib/leads/find-by-email.ts` call needs no lint entry.

## Checks (paste real output, check exit codes; use `rtk proxy` for gating runs)
- `pnpm type-check`
- `pnpm lint`
- `pnpm test`
- `rm -rf .next && DATABASE_URL="postgresql://audit:audit@127.0.0.1:1/none" pnpm exec next build`
- `git diff origin/main --stat -- prisma/` empty.
- Then `parallel-review` (code-reviewer + security-reviewer + codex) and `design-qa` on `/portal/leads/new` before `/cap`.

## Open questions for Adam
1. Should `POST /api/tenant/leads` also get the same dedupe + rate limit (shared helper, 200 `{duplicate:true}` on hit)? Default in this plan: leave it untouched; it stays an unused, un-deduped API.
2. Should the operator be emailed about a lead they just typed in themselves? Plan defaults to yes (existing MANUAL channel, per-org toggle `notifyOnManualLead`); say so if you want it silent for manual adds.
3. Allow adding a lead with no property (org-wide)? Plan requires a property so scoped agents can see it.
4. On duplicate email: block (plan) or offer "add a note to the existing lead" like the public form does?
