# Chatbot Learning Loop Slice Plan

## Working Brief

Feature: turn chatbot learning output into a human-reviewed leasing workflow.

Primary actors: authenticated client operators and agency users impersonating a client.

Core invariant: AI may recommend and draft, but no prospect message is sent and no knowledge/site change is applied without an explicit authorized user action.

Previous behavior preserved: existing lead email/SMS composers remain available, lead/property RBAC remains enforced, learning loop generation remains idempotent, and existing lead cadence emails continue to render in the activity timeline.

Unsafe outcomes: cross-property task mutation, auto-sending AI drafts, double-greeting prospects, applying chatbot knowledge without approval, silently losing dismissal/edit feedback, or marking a task sent when the transport failed.

Assumptions: `LeadFollowUpTask.dueAt` can represent snooze-until for the current schema; actual scheduled cron can reuse the existing run function in a later slice.

## Progress

| Slice | Status | Notes |
| --- | --- | --- |
| 1. Review and send task controls | done | Added approve/dismiss/snooze/send controls, scoped server actions, tests, and build verification. |
| 2. Learning feedback capture | done | Task sends, edits, dismissals, snoozes, and review actions now persist status/audit evidence. |
| 3. Knowledge/site approval actions | done | Added apply/dismiss knowledge fixes, mark reviewed insights, and mark planned/dismiss site recommendations. |
| 4. Scheduled learning cron | pending | Add cron endpoint and Vercel schedule after manual path proves safe. |
| 5. Property-aware draft enrichment | pending | Use property config, tour URL, application URL, and leasing contact rules in drafts. |

## Slice 1: Review and Send Task Controls

Actor/trigger: operator opens a lead detail page with AI follow-up tasks.

Action: approve, dismiss, snooze, or send an AI follow-up draft from the lead page.

Invariant: task lookup must be scoped by org and property; send must use existing email/SMS transport gates; task/draft only become sent after transport success.

Intentional behavior changes: AI follow-up tasks become actionable instead of read-only.

Previous behavior preserved: direct lead email/SMS buttons keep working; AI drafts do not auto-send; uncontactable leads still cannot be emailed/SMSed.

Expected files: `lib/actions/lead-follow-up-tasks.ts`, lead detail UI components, focused tests.

Verification: focused action tests, lint touched files, `tsc --noEmit`, production build before cap.
