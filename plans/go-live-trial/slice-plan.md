# Go-live trial: slice plan (2026-09-27)

Source: .claude/specs/2026-09-27-go-live-trial-handoff.md. Tier 1 (billing state + trial timing).

## Brief
Feature: the trial clock starts when the operator first gets value (go-live), a card is asked for at that
moment with $0 today, reminders are honest about the date and amount, and a lapsed trial with no card pauses
only the live features.
Actors: trial owner (portal, checkout), daily cron (reminders, go-live sweep), public widget/pixel traffic.
Invariant: nobody is charged before the date we showed them, the charge equals the plan x property count we
showed them, and a trial is never shortened.
Previous behaviours kept: checkout is owner-only, trial_activation only, server-owned cart, no duplicate
platform sub, trial_end = org.trialEndsAt; webhook mirrors Stripe trial_end; TRIALING -> ACTIVE only on
invoice.paid; expired trial = read-only workspace; TC (ACTIVE Growth sub) untouched; CANCELED/PAUSED flows
unchanged.
Unsafe: charging before the shown date; trial end moving earlier; DB trial end drifting from Stripe's trial_end
after a card is added; pausing a paying or card-on-file customer's chatbot; dropping reads of data.

## Decisions (assumed, flag if wrong)
- A1 Go-live trial = 14 days from go-live, capped at signup + 30 days (handoff formula).
- A2 New trials start with trialEndsAt = signup + 30 (the setup window). At go-live it becomes
  min(goLive + 14d, signup + 30d). Any existing end other than that signup + 30 placeholder is a floor
  (max(existing, formula)), so legacy 14-day trials never get shorter. Every live trial today is already
  expired, so no current customer's date moves.
- A3 Go-live marker = AuditEvent(entityType "TrialGoLive", entityId orgId). No schema migration, so the
  read-only prod-DB dev server keeps working. Signals: first ChatbotConversation, AppFolio lastSyncAt, or
  Cursive lastPixelHitAt.
- A4 "Card on file" = TRIALING + currentPeriodEnd set (the webhook writes it when a platform sub exists) +
  not cancelAtPeriodEnd. Go-live never changes trialEndsAt once a card is on file (Stripe owns trial_end).
- A5 Reminders: day_7 recap (7 days after go-live or trial start, more than 3 days left), t_minus_3 (amount +
  date + manage link, or "live features pause, data stays"), expired (soft-landing copy). day_2/day_1 retired.
- A6 Soft landing pauses the public chatbot (config/chat/lead/listings-summary, /api/chat) and pixel identity
  ingestion (Cursive processor) for trial_expired with no card. Workspace read-only rule unchanged. API-key
  ingest endpoints (customer's own systems) not paused.

## Progress
| # | Slice | Tier | Status |
|---|---|---|---|
| 1 | Trial clock at go-live: pure computeGoLiveTrialEnd + applyGoLive (signals, marker, monotonic update); start-trial/properties set signup+30; cron + portal layout call it | 1 | done |
| 2 | Go-live card prompt: banner "$0 today, first charge on <date>, cancel in one click" -> /api/billing/checkout; hide activation card when card on file | 1 | done |
| 3 | Reminder emails: day_7 recap, t_minus_3 amount/date/manage, expired soft landing | 2 | done |
| 4 | Soft landing: liveFeaturesPaused() gate on chatbot + pixel; one-click reactivate banner | 1 | pending |

## Slice details
1. Files: lib/billing/go-live-trial.ts (+test), lib/onboarding/steps.ts, wizard start-trial/properties routes,
   app/portal/layout.tsx, app/api/cron/trial-reminders. Tests: formula (early/late go-live, cap, never shorten,
   card on file = no change, expired = no change). Accept: vitest green, tsc green.
2. Files: components/portal/trial-banner.tsx, app/portal/billing/*. Reuse checkout fetch. Browser check on
   demo dev server (read-only; the checkout POST is not exercised there).
3. Files: app/api/cron/trial-reminders/route.ts, pure stage/copy module + test. Amount via
   computeGraduatedMonthlyCents x live property count (same number checkout bills).
4. Files: lib/billing/trial-status.ts (+test), public chatbot routes, /api/chat, lib/webhooks/cursive-process.ts,
   trial banner expired state. Tests: paused only for trial_expired + no card; never for ACTIVE/card on file.
