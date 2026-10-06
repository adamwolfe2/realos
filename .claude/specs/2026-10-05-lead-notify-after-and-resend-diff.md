# Plan: F-062 lead-notify via after() + F-077 Resend audit diff scoping

Date: 2026-10-05 · Status: PLAN ONLY (Tier-1: lead-notify + webhook) · Base: origin/main 753fb5de
Shape: safe-feature-slice (invariants, failure modes, blast radius, tests, rollback). Two independent slices; ship as two commits.

## Corrections to the triage (verified on origin/main)

- `notifyLeadCaptured` never throws: its body is a single try/catch that logs `[lead-notify] failed` (lib/notifications/lead-notify.ts:66-277). Every `.catch(...)` at the call sites is dead code. F-062 is only about **lifetime**: nothing keeps the lambda alive after the response.
- `runAfter` (lib/after.ts) catches and `console.error`s, never throws, and does **not** report to Sentry (unlike `soft()`). When `after()` is available it returns at once. Outside a request scope (`after()` throws) it runs the work **inline and awaits it**.
- `after()` after a streamed response closes is only **partly verified**. The Next 16.3.8 source (`npm pack next@16.3.8`, `dist/server/after/after-context.js:101-133`) shows that AfterContext queues late callbacks: when `isRequestClosed` it runs them after `scheduleImmediate`, and it registers `waitUntil(runCallbacksOnClosePromise)` on the first `after()` call. **Unverified:** whether the request ALS store is still bound inside the AI SDK's `onFinish`, and whether Vercel honours a `waitUntil` registered that late. So the streaming sites (4-6) don't rely on after(); see the Slice A diff sketch.
- Precedent: `app/api/chat/route.ts:327-350` already **awaits** `notifyLeadCaptured` inside `onFinish` ("the lambda stays alive"). The public chatbot copy at `app/api/public/chatbot/chat/route.ts:547` is the odd one out.
- Two capture sites the triage missed: `lib/webhooks/cursive-process.ts:580` (PIXEL channel, called from both cursive webhook routes) and the inner `void pushLeadToFunnel` at `lead-notify.ts:118`. The inner push stays fire-and-forget even inside after(), because the after callback resolves before it finishes. It's out of scope here (lead-notify internals), but it's the same bug class.
- Sites at triage lines public/leads 256 and 287 and chatbot/chat 564 and 584 are **not** `notifyLeadCaptured`. They are the bell (`notifyLeadCreated` / `notifyChatbotLeadCaptured`), the Slack/tenant/auto-reply `Promise.allSettled` batch, and the prospect-profile email. Same bug, so this plan includes them.
- `__tests__/chatbot-capture-timing.test.ts` only tests prompt wording (buildSystemPrompt). It is irrelevant to notify timing and needs no change.
- F-077 is **latent**: no UI reads EmailEvent `diff`. The tenant audit log (app/portal/settings/audit-log/page.tsx:37-56) and the admin pages select no `diff`. Exposure today is DB-level and any future export or diff viewer. The Resend `data.to` can also be an array, so `diff` can hold *other recipients'* addresses.

## Slice A: F-062 lead-capture notifications survive the response

### Invariants
1. Lead creation never blocks on, or fails because of, a notification. The response status and body are unchanged.
2. Every non-streaming capture site's notify work is registered with `after()` (via `runAfter`). The streaming chat sites (4-6) await it inline in `onFinish`, following the app/api/chat/route.ts:327-350 precedent. Either way the lambda stays alive until it settles.
3. Notify failures are logged **and reported to Sentry**: runAfter's `[after:<label>]` log plus `captureWithContext`, and lead-notify's own log. This replaces the `soft()` signal at sites 1-2. No `catch {}` is added.
4. Dedupe and gating stay byte-identical: `!existing`, `isNew`, `lead.notify`, `isRepeatInquiry`, and the `!conversation.leadId` guards. Only the wrapper changes.
5. lead-notify.ts, AppFolio sync and `app/api/audit/start/route.ts:182` are untouched.

### Exact sites (current code → change)
| # | File:line | Current | Label |
|---|---|---|---|
| 1 | app/api/public/leads/route.ts:256 | `void notifyLeadCreated(lead).catch(soft(...))` | `public.leads.bell` |
| 2 | app/api/public/leads/route.ts:262-277 | `void notifyLeadCaptured({...}).catch(soft(undefined,"public.leads.notifyLeadCaptured"))` | `public.leads.notify` |
| 3 | app/api/public/leads/route.ts:287 | `void Promise.allSettled([notifyNewLeadSlack, tenant email, auto-reply...])` | `public.leads.side-effects` |
| 4 | app/api/public/chatbot/chat/route.ts:547-563 | `void notifyLeadCaptured({...}).catch(console.warn)` (inside onFinish → persistConversation) | `chatbot.chat.notify` |
| 5 | app/api/public/chatbot/chat/route.ts:564-572 | `void notifyChatbotLeadCaptured(...).catch(console.warn)` | `chatbot.chat.bell` |
| 6 | app/api/public/chatbot/chat/route.ts:584-590 | `void sendProspectProfileForConversation({... force:true}).catch(console.warn)` | `chatbot.chat.profile` |
| 7 | app/api/public/chatbot/lead/route.ts:256-270 | `void notifyLeadCaptured({...}).catch(console.warn)` | `chatbot.lead.notify` |
| 8 | app/api/public/chatbot/lead/route.ts:272-278 | `void notifyChatbotLeadCaptured(...).catch(() => {})` (swallowed) | `chatbot.lead.bell` |
| 9 | app/api/public/popup/lead/route.ts:267-278 | `void notifyLeadCaptured({...}).catch(() => {})` | `popup.notify` |
| 10 | app/api/public/tours/route.ts:127-134 | `void notifyTourScheduled({...}).catch(() => {})` | `tours.bell` |
| 11 | app/api/public/tours/route.ts:140-152 | `void notifyLeadCaptured({...}).catch(() => {})` | `tours.notify` |
| 12 | app/api/ingest/lead/route.ts:146-160 | `void notifyLeadCaptured({...}).catch(console.warn)` | `ingest.lead.notify` |
| 13 | app/api/ingest/chatbot/route.ts:229-245 | `void notifyLeadCaptured({...}).catch(console.warn)` | `ingest.chatbot.notify` |
| 14 | app/api/tenant/leads/route.ts:164-179 | `void notifyLeadCaptured({...}).catch(() => {})` | `tenant.leads.notify` |
| 15 | app/api/tenant/visitors/[visitorId]/convert/route.ts:144-158 | `void notifyLeadCaptured({...}).catch(() => {})` | `visitor.convert.notify` |
| 16 | lib/webhooks/cursive-process.ts:580-598 | `void notifyLeadCaptured({...}).catch(() => {})` | `cursive.notify` |

Site 16 is new vs the triage. It runs once per webhook event in a loop that is already awaited (`await processCursiveEvent`). runAfter works there because it's in request scope.

### Diff sketch (same shape at every site)
```ts
import { runAfter } from "@/lib/after";
// before
void notifyLeadCaptured({ ...input }).catch(() => {});
// after
await runAfter("tours.notify", () => notifyLeadCaptured({ ...input }));
```
- Use `await runAfter`. In a request it returns immediately. In the inline fallback (tests, scripts) the work finishes deterministically. This matches lib/audit/notify.ts:26 and lib/billing/go-live-trial.ts:149.
- Site 3: `await runAfter("public.leads.side-effects", async () => { await Promise.allSettled([...]); });`
- Sites 1, 2, 8, 10 drop the dead or swallowing `.catch`. Sentry coverage moves into runAfter (below).
- **lib/after.ts (part of this slice):** in the `safe()` catch, add `captureWithContext(err, { after: label })` (import from `@/lib/sentry`) after the existing `console.error`. Every runAfter caller gains Sentry reporting. This changes behaviour for the existing callers (analytics, funnel-alert, audit notify, go-live): their failures now report too, which is intended.
- **Sites 4-6 (streaming, inside `persistConversation` ← `onFinish`): no runAfter.** Follow the app/api/chat/route.ts:327-350 precedent and await inline:
```ts
const results = await Promise.allSettled([
  notifyLeadCaptured({...}),                  // site 4
  notifyChatbotLeadCaptured({...}),           // site 5
  sendProspectProfileForConversation({ conversationId: conversation.id, force: true, reason: "auto-capture" }), // site 6
]);
for (const r of results) {
  if (r.status === "rejected") {
    console.error("[public/chatbot/chat] post-capture side effect failed:", r.reason);
    captureWithContext(r.reason, { route: "public.chatbot.chat", step: "post-capture" });
  }
}
```
  Keep the `lead.notify` gate on sites 4-5 only (site 6 currently fires regardless), e.g. push 4-5 into the array conditionally. onFinish already awaits `persistConversation` inside a try/catch that logs, so stream close waits for these (the visitor already has the full text). The precedent comment states this keeps the lambda alive.

### Failure modes
| Mode | Today | After |
|---|---|---|
| Lambda freezes after response | Email or bell silently lost | after() keeps the invocation alive up to maxDuration |
| Resend or DB down | Logged, response OK | Same. runAfter logs `[after:label]` and the response is unaffected |
| after() unavailable (cron/script/test) | n/a | Runs inline and awaited, so the request is slower but correct |
| Streaming sites 4-6 slow (Resend lag) | Lost if the lambda froze | Stream close is delayed by the notify time (text already delivered). Bounded by maxDuration=30s |
| Notify slower than maxDuration (chat=30s) | Lost | Still cut off at maxDuration. lead-notify uses Resend SDK with no explicit timeout, which is acceptable |
| Inner `void pushLeadToFunnel` (lead-notify.ts:118) | Can drop | **Can still drop**. Follow-up slice |
| Double-send | Guarded by existing dedupe | Unchanged. The wrapper never retries |

### Blast radius
16 call sites in 10 files, plus 2 lines (import + capture) in lib/after.ts, which affect all runAfter callers. No schema, no env, no API contract change. Customer-visible effect: operators receive emails and bells that were being dropped. Watch for a rise in Resend volume, which is expected and equals the leads that were lost before.

### Tests
- **New `__tests__/lead-notify-after.test.ts`**, mocking next/server `after` as in __tests__/analytics.test.ts:23. Mock `after` to capture the callback without running it. Call POST on `app/api/public/tours/route.ts` and `app/api/public/popup/lead/route.ts` with mocked prisma. Pin the popup fixture to the net-new lead path (the only path returning 201; the soft-deny branches near lines 146/161/176 return 200). Assert (a) the response is 201 before the callback runs, (b) `notifyLeadCaptured` has **not** been called yet, (c) after running the captured callback it was called once with the expected channel. Add one case where the notify mock rejects: the callback resolves, console.error contains `[after:tours.notify]`, and the mocked `captureWithContext` is called once with `{ after: "tours.notify" }`.
- **Source guard in the same file:** read all 10 files and assert none match `/void\s+(notify\w+|sendProspectProfileForConversation|Promise\.allSettled)\(/`. This pins every site and its side effects cheaply.
- **Streaming sites:** in `__tests__/chatbot-spend-cap.test.ts` style (it already drives `publicChat` with mocks), add a case where the onFinish capture path runs. Assert `notifyLeadCaptured` and `sendProspectProfileForConversation` were awaited (called) before the POST stream finished, and that a rejection logs and calls `captureWithContext`.
- Existing, must stay green unchanged: `__tests__/lead-notify-funnel.test.ts` (lead-notify internals untouched), `__tests__/public-leads-route.test.ts` (asserts notify call counts; the real `after` throws outside scope, so the inline fallback still calls the mock), `__tests__/chatbot-lead-error-parity.test.ts`, `__tests__/chatbot-spend-cap.test.ts`. The last mocks `notifyLeadCaptured: vi.fn()` returning `undefined`. Today `.catch` on undefined would throw, but after the change `await undefined` is fine, so it gets safer.
- `__tests__/chatbot-capture-timing.test.ts`: no change (prompt-only).

### Checks
`pnpm typecheck` · `pnpm lint` · `pnpm test` · `rm -rf .next && DATABASE_URL="postgresql://audit:audit@127.0.0.1:1/none" pnpm exec next build` (expect exit 0; one caught sitemap enumeration error is normal). Never `pnpm build`, vercel-build or `db:*`. Use `rtk proxy` and read exit codes. Runtime proof: on a preview deploy, submit a tour or popup lead and confirm the operator email arrives and the Vercel log shows no `[after:` errors.

### Rollback
Revert the single commit. Pure call-site wrapper, no data written differently.

### Effort
~1.5h, including the new test.

### Remaining `void` sites (43 total on main; 16 handled above)
- **Worth a later slice (operator- or customer-visible email lost on freeze):** content-draft review and submit emails (app/api/admin/content-approvals/[id]/decide:171,178; content-drafts/[id]/approve:131,138; reject:106,113; portal/content/[id]/submit:96; portal/seo/drafts:306,313), `notifyNewIntake` (intake/[id]/cal-booked:75), `sendProspectProfileForConversation` (tenant/conversations/[id]/handoff:120), `notifyOpsOfQuoteCheckoutDrop` (webhooks/stripe:1361, Tier-1), `sendPixelReadyCustomerEmail` (lib/actions/admin-cursive:290), onboarding `Promise.allSettled` (api/onboarding:149), content-drafts/bulk:138, `notifySlack` (tenant/creative-requests:122), `pushLeadToFunnel` (lead-notify.ts:118, CRM push).
- **Leave or treat separately:** `runAdsSyncForAccount` x4 and `runSeoSync` (long syncs, which belong in cron or a queue, not after()), `logUsage` x2 and `persistRecommendations` (best-effort telemetry), `healStalledProspectAudit` (page render; already self-heals on the next view), `sendChat` (client component, not server).

## Slice B: F-077 Resend webhook audit rows stop copying the full payload

### Invariants
1. AuditEvent `diff` for `entityType: "EmailEvent"` contains only `{ type, email_id }`. Never subject, from, other `to` recipients, click link, bounce detail or headers.
2. Per-tenant fan-out is unchanged: one audit row per matching lead, plus the opened/clicked `lastActivityAt` and bounced/complained unsubscribe across **all** matching tenants.
3. Signature verification (lib/email/resend-webhook-signature.ts, pinned by __tests__/resend-webhook-signature.test.ts), the 3 MB cap, rate limiting and JSON handling are untouched.
4. No schema change. `diff` stays `Json?`.

### File and current code
`app/api/webhooks/resend/route.ts:84-93` (the triage said ~100; it's line 91):
```ts
diff: payload as unknown as Prisma.InputJsonValue,
```
`description` (`${type}, ${to}`) is already per-recipient and stays.

### Diff sketch
```ts
diff: { type, email_id: payload.data?.email_id ?? null },
```
Change line 4 to `import { AuditAction } from "@prisma/client";`: `Prisma` is only used at line 91, so it must be removed unconditionally. Optionally build the object once above the loop.

### Failure modes
- Resend omits `email_id` → stored as `null`. Fine.
- Losing forensic detail (subject) for our own debugging: Resend's dashboard holds it, looked up by `email_id`.
- Cross-tenant side effects (tenant A's email open bumps tenant B's `lastActivityAt`; a bounce unsubscribes everywhere) stay **by design** per brief. Noted, not changed.

### Tests (`__tests__/resend-webhook-engagement.test.ts`, test-pinned)
No existing assertion breaks: the file never inspects `diff`. Change: **add** assertions, weaken none.
- In "writes one audit row per matching tenant lead" (line 100), also assert each call's `data.diff` `toEqual({ type: "email.clicked", email_id: <id> })`.
- New case: payload with `subject`, `from` and a multi-address `to` → `diff` has **no `to` key** (`expect(diff).not.toHaveProperty("to")`), and `JSON.stringify(diff)` contains none of the subject, the from address or the other recipient.
- `signed(type, to)` (line 28) only sends `{ type, data: { to } }`. Extend it with an optional `extra` data arg (`signed(type, to, { email_id, subject, from })`). That's a helper addition, not a weakening.
- `__tests__/resend-webhook-signature.test.ts` is untouched and must pass as-is.

### Checks
Same as Slice A.

### Rollback
Revert the commit. Rows written in between simply have smaller diffs.

### Effort
~30 min.

### Existing leaked rows (destructive, so Adam decides; not part of this slice)
Every historical `AuditEvent` with `entityType = 'EmailEvent'` holds the full payload. No current UI exposes it, so this is cleanup for data minimization, not an active leak. Option, after a backup or Neon branch snapshot:
```sql
UPDATE "AuditEvent"
SET diff = jsonb_build_object('type', diff->>'type', 'email_id', diff->'data'->>'email_id')
WHERE "entityType" = 'EmailEvent' AND diff ? 'data';
```
Check the mapped table name in prisma/schema.prisma:2634 first, then run on a Neon branch, compare counts and promote. This is irreversible without the snapshot.

## Decisions for Adam
1. **Include site 16 (cursive pixel) and the non-email side effects (bell, Slack, prospect-profile) in Slice A?** Default: yes, same bug and same wrapper.
2. **Backfill-scrub historical EmailEvent diffs?** Default: no, because nothing reads them. Revisit if an audit-log export ships.
3. **Follow-up slice for `pushLeadToFunnel` inside lead-notify** (still fire-and-forget)? Default: yes, after A lands.
