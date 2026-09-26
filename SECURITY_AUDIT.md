# SECURITY AUDIT — LeaseStack

- **Project:** LeaseStack (`leasestack`) — managed marketing SaaS for real-estate operators
- **Repository:** `adamwolfe2/realos` (single Next.js 16 App Router monolith serving four surfaces)
- **Mode:** `AUDIT_AND_FIX_SAFE` (confirmed Critical/High fixes implemented; breaking/architectural changes proposed only)
- **Date:** 2026-08-15
- **Branch:** `claude/security-audit-remediation-aqojq0`
- **Auditor:** Principal application-security review (static analysis + safe local verification; no production testing, no live-secret rotation)

> Operational settings honored: `ACTIVE_PRODUCTION_TESTING=FALSE`, `DESTRUCTIVE_TESTING=FALSE`,
> `DEPLOY_CHANGES=FALSE`, `ROTATE_LIVE_SECRETS=FALSE`, `BREAKING_CHANGES_ALLOWED=FALSE`.
> `CREATE_SECURITY_TESTS=TRUE`, `CREATE_SECURITY_REPORT=TRUE`.

---

## 1. Executive summary

LeaseStack is a **mature, security-conscious codebase** with an unusually strong baseline: disciplined multi-tenant scoping (`tenantWhere(scope)` + per-user property RBAC), a well-built DNS-resolving SSRF guard, envelope-encrypted credential vault (AES-256-GCM, per-org DEK), signature-verified webhooks with replay/idempotency, constant-time secret comparisons, fail-closed rate limiting in production, and strong HTTP security headers. Extensive prior-audit remediation is visible throughout. **No committed secrets** were found in the working tree or git history; `.env.example` is placeholder-only.

The most valuable assets are tenant PII (leads, residents, applications, visitor identity graph), the encrypted third-party credential vault, Stripe billing/entitlement state, and the shared Anthropic/DataforSEO/Cursive integration budgets. The most exposed surfaces are the hostname-routed public tenant sites (chatbot, popup, lead capture), the unauthenticated site-request intake, and the scoped ingest API.

This review confirmed **1 Critical, 4 High, 6 Medium, and 8 Low/Informational** findings. **No secret appears compromised.** No broad cross-tenant read was found in the ~216 API route handlers — tenant isolation is correct and consistent there. The confirmed cross-tenant exposures were narrower: **two `"use server"` helpers exported as network-reachable Server Actions with no authorization** (audience-segment push returning member PII; Cursive visitor injection), and a **readable SSRF** where an anonymous intake submitter could make the server fetch internal/metadata URLs and return the bytes to an agency admin. Authentication and payment flows are otherwise safe — checkout prices/entitlements are server-owned and never trusted from the client, and provisioning waits for verified Stripe events. AI agents hold **no tool-calling authority at all** (no model-gated privileged actions exist), which removes the most dangerous AI vulnerability class by design.

All confirmed Critical/High findings, plus several Medium ones, were **fixed on this branch with regression tests** (24 files changed, 5 new tests). Remaining items are hardening or require product/architecture decisions. **Verdict: `CONDITIONAL_RELEASE`** — the code is releasable once the External Verification checklist (§7) is satisfied and the two remaining self-service entitlement/role gaps (P1-4, P2-5) are decided.

---

## 2. Architecture & trust-boundary summary

**Stack:** Next.js 16 (App Router, Turbopack), TypeScript strict, React 19, Prisma 7 + Neon Postgres, Clerk (multi-org auth), Stripe (billing), Resend (email), Anthropic Claude (chatbot + SEO drafter), Upstash Redis (rate limiting), Vercel Blob (storage), Vercel hosting, Sentry + PostHog.

**Four surfaces, one app, routed by hostname in `middleware.ts`:**
1. Platform marketing site (`leasestack.co`)
2. Master admin (`/admin`) — agency staff, cross-tenant, impersonation
3. Client portal (`/portal`) — operator dashboard
4. Tenant marketing sites (hostname-routed `app/(tenant)`) — public chatbot/popup/lead widgets

**Trust boundaries:**
- **Hostname → tenant:** `lib/tenancy/resolve.ts`; middleware strips any inbound `x-tenant-*` header and re-sets it only from the resolved hostname (anti-spoof, correct).
- **Session → scope:** `getScope()` (`lib/tenancy/scope.ts`) resolves a single `ScopedContext` per request; `requireScope/requireAgency/requireClient/requireWritableWorkspace` gate; `tenantWhere(scope)` + `propertyInScope` filter every tenant query. Impersonation is Clerk-session-bound.
- **API keys:** `re_live_…` bearer tokens, SHA-256-hashed at rest, scoped, revocable/expirable; org derived from the key row, never the request body (`lib/api-keys/*`).
- **Public widget endpoints:** authorize via `requireMatchingOrigin` (Origin/Referer host must resolve to the claimed orgId).
- **Webhooks:** Stripe/Clerk(svix)/Resend/Cursive/Cal.com — signature-verified on the raw body, fail closed, idempotent.
- **Vault:** two-tier envelope encryption (`VAULT_MASTER_KEK_B64` → per-org DEK → per-credential AES-256-GCM).

**Sensitive data:** lead/resident/applicant PII, visitor identity graph, chatbot transcripts, encrypted integration credentials (AppFolio/OAuth/ad tokens), Stripe customer/subscription state, proprietary prompts.

**External config requiring verification (not provable from repo):** Clerk dashboard (MFA, session policy, webhook secret), Stripe (webhook signing secret, live-mode), Neon (network access, TLS, least-priv role), Vercel (env separation, blob store visibility, `DEMO_MODE`/`CHATBOT_ALLOW_ANY_ORIGIN` unset in prod, source-map exposure), Upstash (provisioned in prod so rate limiting fails closed), DNS/DMARC, cloud IAM, branch protection.

---

## 3. Priority risk register

| # | Finding ID | Severity | Confidence | Component | Exposure | Attack scenario | Impact | Recommended action | Status |
|---|---|---|---|---|---|---|---|---|---|
| 1 | SSRF-01 | **Critical** | High | `app/api/site-requests/**` | Internet (unauth) | Anonymous intake submits `blobUrl=http://169.254.169.254/…`; agency admin later downloads the build packet → server fetches it and returns bytes in the zip | Readable SSRF: cloud-metadata creds / internal service data exfiltration | Pin `blobUrl` to Vercel blob host + guard packet fetch | **FIXED** |
| 2 | AUTHZ-SA1 | **High** | High | `lib/actions/audiences.ts` | Internet (client bundle) | Call the exported `executeSegmentPush` Server Action with an arbitrary `orgId` | Cross-tenant: push another tenant's audience, receive `csvBase64` member PII | Require in-process `INTERNAL_CALL` token | **FIXED** |
| 3 | AUTHZ-SA2 | **High** | High | `lib/actions/admin-cursive.ts` | Internet (client bundle) | Call exported `runCursiveSegmentSync(orgId)` | Cross-tenant visitor injection + falsified pixel telemetry + shared API-key burn | Require `INTERNAL_CALL` token | **FIXED** |
| 4 | SUPPLY-NEXT | **High** | High | `next` 16.2.6 | Internet | Known advisories: App Router middleware/proxy bypass, SSRF in Server Actions, DoS (`<16.2.11`) | Middleware auth model is load-bearing here → bypass risk | Upgrade to 16.2.12 | **FIXED** |
| 5 | AUTHZ-ADMIN | **High** | Medium | `lib/auth/require-admin.ts` | Authenticated | A user with an agency ROLE on a CLIENT-typed org passes 13 admin routes (role-only check) | Cross-tenant admin | Also require `orgType === AGENCY` | **FIXED** |
| 6 | SSRF-02 | **Medium-High** | High | `lib/aeo/run-onpage-audit.ts` | Authenticated (AEO add-on) | Supply a hostname whose A-record resolves to a private IP (regex guard has no DNS) | Readable SSRF w/ response excerpt exfil | Route through central DNS guard | **FIXED** |
| 7 | PAY-ENT1 | **Medium** | High | `app/api/onboarding/wizard/start-trial` | Authenticated | Churned (`CANCELED`/`PAUSED`) org POSTs to re-trial | Self-grant paid module entitlements + fresh trial, no Stripe | Exclude terminal paid states | **FIXED** |
| 8 | FILE-SVG | **Medium** | High | `app/api/site-requests/upload` | Internet (unauth) | Upload `image/svg+xml` with `<script>` to public blob | Hosted stored-XSS / phishing under a look-alike domain | Exact MIME allowlist + pinned content-type | **FIXED** |
| 9 | XSS-BLOB | **High** | High | `app/admin/site-engine/[id]` | Authenticated admin | `blobUrl=javascript:…` (z.string().url() accepts it) rendered as `<a href>` | Stored XSS on app origin w/ admin session | Same schema pin as SSRF-01 (https blob host only) | **FIXED** |
| 10 | ABUSE-MKT | **Medium** | High | `app/api/marketplace/{auth,seller-auth}/request` | Internet (unauth) | Unbounded magic-link POSTs | Account-row spam + Resend email bombing | Add per-IP rate limit | **FIXED** |
| 11 | AUTHZ-PROP | **Medium** | High | `app/api/tenant/creative-requests/[id]/{status,messages}` | Authenticated (restricted seat) | Property-restricted user acts on a creative request for a property outside their grant | Intra-tenant property-RBAC bypass | Add `propertyInScope` gate | **FIXED** |
| 12 | AUTHZ-SELF | **Medium** | Medium | `lib/actions/manage-team.ts` | Authenticated (CLIENT_ADMIN) | `updatePropertyAccessAsClient({userId: self, propertyIds: []})` → grants collapse to unrestricted | Self property-scope escalation | Subset-of-caller check; block self-target | **PROPOSED** |
| 13 | AUTHZ-WIZ | **Medium** | Medium | `app/api/onboarding/wizard/{workspace,features}` | Authenticated (any seat) | Any org member (viewer) renames org / rewrites module flags | Entitlement + identity tamper by low-priv seat | Add role gate (`ALLOWED_ROLES`) | **PROPOSED** |
| 14 | AI-DEMO | **Medium** | High | `app/api/public/chatbot/demo` | Internet (unauth) | Client-supplied `facts` spliced into system prompt; no auth/quota/logUsage | Open LLM proxy on our Anthropic bill | Signed context token from `scrape` + quota + logUsage | **PROPOSED** |
| 15 | AI-ORIGIN | **Medium** | High | `lib/tenancy/origin-guard.ts` | Internet | Spoof `Origin: https://victim.slug.leasestack.co` | Per-tenant chatbot DoW/DoS + pipeline poisoning | Replace Origin trust with server-issued HMAC token | **PROPOSED** |
| 16 | AI-COST | **Medium** | High | `lib/cost-tracker/cap.ts` | Internet/auth | `withSpendCap` defined but never called; chat/content routes don't `logUsage` | No hard per-org/global Anthropic spend ceiling | Wire spend cap + logUsage on all model calls | **PROPOSED** |
| 17 | TOKEN-CUID | **Medium** | Medium | `app/preview/{content,neighborhood}/[id]` | Internet | CUID treated as a bearer capability (~40 unpredictable bits) | Unpublished tenant content disclosure | Use real random share tokens | **PROPOSED** |
| 18 | CHAT-XT | **Low** | Medium | `app/api/chat/route.ts` | Internet | Reuse a known victim `sessionId` (needs origin bypass + UUID leak) | Cross-tenant conversation overwrite | Mirror public route's orgId refusal | **FIXED** |
| 19 | ORIGIN-PROD | **Low** | High | `CHATBOT_ALLOW_ANY_ORIGIN` | Config | Flag set in prod removes origin binding | Open chatbot abuse | Hard prod refusal (like DEMO_MODE) | **FIXED** |
| 20 | WEB-CSP | **Low-Med** | High | `next.config.mjs` | Internet | `script-src 'unsafe-inline' 'unsafe-eval'` weakens XSS mitigation | Larger XSS blast radius | Nonce-based CSP; drop `unsafe-eval` | **PROPOSED** |
| 21 | WEBHOOK-RESEND | **Low** | Medium | `app/api/webhooks/resend` | Internet | Svix secret used raw (not base64-decoded) | Bounce/complaint handling silently drops (fails closed) | Use svix lib; add idempotency | **PROPOSED** |
| 22 | IMP-CAP | **Low** | High | `lib/tenancy/impersonate.ts` | Authenticated (agency) | `impersonateStartedAt` stamped but never enforced | Impersonation never ages out | Enforce the documented 8h cap | **PROPOSED** |

Lower-severity/informational items (cursive shared-secret length-oracle, AL_PARTNER audit pollution, `checkSmsConfigured` ungated, public-read tenant document blobs, health/deep org-count disclosure, 50k-row PII export) are catalogued in §4 and the checklist matrix.

---

## 4. Confirmed findings (detail)

### [SSRF-01] Unauthenticated readable SSRF via site-request asset URLs
- **Status:** FAIL_CONFIRMED → **FIXED**
- **Classification:** Confirmed vulnerability · **Severity:** Critical · **Confidence:** High · **Exploitability:** Easy · **Exposure:** Internet-facing (unauthenticated)
- **Affected component:** `lib/site-engine/intake-schema.ts` (`blobUrl: z.string().url()`), `app/api/site-requests/route.ts` (unauth POST persists assets verbatim), `app/api/site-requests/[id]/packet/route.ts:201` (`fetch(asset.blobUrl)`, default `redirect: follow`, no guard).
- **Attack scenario:** Anonymous submitter posts an intake with `assets[].blobUrl = http://169.254.169.254/latest/meta-data/iam/security-credentials/` (or an internal `http://10.x`/`http://127.0.0.1:port`). When an agency admin later downloads the build packet, the server fetches each URL and places the **response bytes into the zip** returned to the admin — a readable (not blind) SSRF against the cloud metadata endpoint and internal network.
- **Impact:** Cloud credential / internal-service data exfiltration.
- **Root cause:** Free-form URL trusted from an unauthenticated source and later fetched by privileged server code.
- **Remediation (implemented):** `blobUrl` is pinned to the Vercel public-blob host (`*.public.blob.vercel-storage.com`, https only) in the shared schema — all legitimate uploads land there. Defense in depth: the packet route now calls `assertPublicHttpUrl` + `safeFetchFollowingRedirects` (DNS-resolved, private/metadata ranges blocked, per-hop redirect re-validation) before fetching.
- **Regression test:** `__tests__/security-intake-blob-url.test.ts`, `__tests__/security-remediation-invariants.test.ts`.
- **Residual risk:** Rows written before this deploy could still carry arbitrary blobUrls; the packet-route guard covers them at fetch time.

### [AUTHZ-SA1 / AUTHZ-SA2] `"use server"` internals exported as unauthorized Server Actions
- **Status:** FAIL_CONFIRMED → **FIXED**
- **Classification:** Confirmed vulnerability (cross-tenant) · **Severity:** High · **Confidence:** High · **Exploitability:** Moderate · **Exposure:** Internet (action IDs live in the client bundle)
- **Affected component:** `lib/actions/audiences.ts::executeSegmentPush` (takes `orgId`, no scope check; returns `csvBase64` member PII for CSV destinations), `lib/actions/admin-cursive.ts::runCursiveSegmentSync` (takes `orgId`, no scope check; writes Visitor rows).
- **Attack scenario:** Every exported async function in a `"use server"` module is a network-reachable Server Action. Both files' own comments say "callers MUST authorize before invoking this," but the framework exposes them anyway. A remote caller invokes the raw action ID with an arbitrary `orgId`.
- **Impact:** Cross-tenant audience-member PII exfiltration; cross-tenant visitor injection + falsified pixel telemetry + shared Cursive API-key burn; cross-tenant existence oracle.
- **Root cause:** Design intent ("internal, pre-authorized") not enforceable in a `"use server"` module.
- **Remediation (implemented):** Added `lib/security/internal-call.ts` — an in-process capability token (`INTERNAL_CALL`, a module-private `Symbol` that cannot cross the Server-Action deserialization boundary). Both helpers now take the token as a required parameter and `assertInternalCall()` at entry; the guarded wrappers, cron handlers, and the one CLI script pass it. A direct network invocation cannot supply the symbol and fails closed.
- **Regression test:** `__tests__/security-internal-call.test.ts`, `__tests__/security-remediation-invariants.test.ts`.
- **Residual risk:** None for these two; a lint rule enforcing the pattern for all `"use server"` internals is recommended (see Top-10 #9).

### [SUPPLY-NEXT] Next.js on a version with App-Router advisories
- **Status:** FAIL_CONFIRMED → **FIXED** · **Severity:** High · **Confidence:** High · **Exposure:** Internet
- **Evidence:** installed `next@16.2.6`; advisories affect `>=16.0.0 <16.2.11` — App Router middleware/proxy bypass, SSRF in Server Actions, DoS. This app's entire auth/tenant model runs through middleware, so a middleware bypass is directly load-bearing.
- **Remediation (implemented):** pinned `next` to `~16.2.12` (patched, same minor line — minimal behavior change). Full suite + typecheck re-run green.

### [AUTHZ-ADMIN] `requireAdmin` checks role but not org type
- **Status:** FAIL_CONFIRMED → **FIXED** · **Severity:** High · **Confidence:** Medium · **Exposure:** Authenticated
- **Evidence:** `lib/auth/require-admin.ts` gated on `role ∈ {AGENCY_OWNER, AGENCY_ADMIN}` only, unlike `requireAgency()` which requires `orgType === AGENCY` AND an agency role precisely because the Clerk `membership.deleted` handler re-homes removed client users into the agency org. 13 admin routes depend on this helper.
- **Remediation (implemented):** both `requireAdmin` and `requireAdminOrRep` now also require `user.org.orgType === AGENCY`.
- **Regression test:** `__tests__/require-admin-clerk-lookup.test.ts` (new cases: agency role on CLIENT org → Forbidden).

### [SSRF-02] AEO on-page audit uses a regex-only (no-DNS) SSRF guard
- **Status:** FAIL_CONFIRMED → **FIXED** · **Severity:** Medium-High · **Confidence:** High · **Exposure:** Authenticated (AEO add-on / agency)
- **Evidence:** `lib/aeo/run-onpage-audit.ts` `PRIVATE_HOSTNAME_PATTERNS` matched only literal IP strings; a public hostname resolving to `169.254.169.254`/`127.0.0.1`/RFC-1918 passed and was fetched, and the excerpt returned to the caller.
- **Remediation (implemented):** direct-fetch path now calls `assertPublicHttpUrl` + `safeFetchFollowingRedirects` from the central guard (DNS-resolved, all A/AAAA checked, per-hop redirect re-validation). `normalizeUrl`'s literal checks retained as a first filter.
- **Regression test:** `__tests__/security-remediation-invariants.test.ts`.

### [PAY-ENT1] Self-service re-trial of churned/paused workspaces
- **Status:** FAIL_CONFIRMED → **FIXED** · **Severity:** Medium · **Confidence:** High · **Exposure:** Authenticated
- **Evidence:** `app/api/onboarding/wizard/start-trial/route.ts` excluded only `ACTIVE`/`PAST_DUE`; `CANCELED` and `PAUSED` (terminal/read-only states set by the Stripe lifecycle) could be flipped back to `TRIALING`, re-granting the à-la-carte module set (and, for a never-trialed proposal-provisioned org, a fresh 14-day window) with no Stripe event.
- **Remediation (implemented):** `CANCELED` and `PAUSED` added to the exclusion; only `null` (new) and `TRIALING` (idempotent onboarding) remain eligible.
- **Regression test:** `__tests__/security-remediation-invariants.test.ts`. **Note:** the sibling gap (any low-priv seat can rewrite entitlements — AUTHZ-WIZ) is *proposed*, not fixed, to avoid breaking the onboarding role model.

### [FILE-SVG + XSS-BLOB] SVG / `javascript:` on the public intake
- **Status:** FAIL_CONFIRMED → **FIXED** · **Severity:** Medium (SVG) / High (javascript: XSS) · **Confidence:** High · **Exposure:** Internet + admin
- **Evidence:** `app/api/site-requests/upload/route.ts` allowed by `image/` prefix (admits `image/svg+xml`) on an unauthenticated public-blob writer; `blobUrl: z.string().url()` accepts `javascript:alert(1)` rendered as `<a href>` in `app/admin/site-engine/[id]`.
- **Remediation (implemented):** upload route uses an exact MIME allowlist (jpeg/png/webp/gif/avif/pdf, no SVG/HTML) and pins the served `contentType`; the blobUrl host-pin (SSRF-01) removes the `javascript:`/`data:` scheme at the schema layer.
- **Regression test:** `__tests__/security-remediation-invariants.test.ts`, `__tests__/security-intake-blob-url.test.ts`.

### [ABUSE-MKT] Unauthenticated marketplace magic-link routes lacked rate limiting
- **Status:** FAIL_CONFIRMED → **FIXED** · **Severity:** Medium · **Exposure:** Internet
- **Evidence:** `app/api/marketplace/auth/request` and `.../seller-auth/request` created buyer/seller rows and sent email per call with no limiter.
- **Remediation (implemented):** both now call `checkRateLimit(publicSignupLimiter, ip)` (fail-closed in prod), returning 429.

### [AUTHZ-PROP] Creative-request status/messages skipped property RBAC
- **Status:** FAIL_CONFIRMED → **FIXED** · **Severity:** Medium · **Exposure:** Authenticated (restricted seat)
- **Evidence:** both `[id]/status` and `[id]/messages` used org-only `tenantWhere` without `propertyInScope`, letting a property-restricted user approve/reject/deliver/message a creative request outside their property grant (the create route already gates it).
- **Remediation (implemented):** both routes now call `propertyInScope(scope, current.propertyId)` → 404 on mismatch.
- **Regression test:** `__tests__/security-remediation-invariants.test.ts`.

### [CHAT-XT + ORIGIN-PROD] Consistency hardening
- **Status:** FIXED · **Severity:** Low
- `app/api/chat/route.ts` now refuses an upsert when an existing conversation's `orgId` differs (mirrors the hardened public route). `CHATBOT_ALLOW_ANY_ORIGIN` is now hard-refused in production via `chatbotOriginBypassEnabled()` (mirrors DEMO_MODE). Test: `__tests__/security-chatbot-origin-bypass.test.ts`.

### Proposed (not implemented — behavior-affecting or architectural)
- **AI-DEMO / AI-ORIGIN / AI-COST:** the demo chatbot is an open, unauthenticated LLM proxy with a client-controlled system prompt; the public-chatbot origin guard is a spoofable header treated as the primary control; `withSpendCap` is defined but never wired and the highest-volume chat routes never `logUsage`. Together these are a denial-of-wallet exposure on the shared Anthropic budget. Fix path: server-issued HMAC context/session token replacing Origin trust, and wiring the spend cap + `logUsage` on every model call.
- **AUTHZ-SELF (P1-4):** `updatePropertyAccessAsClient` lets a property-restricted `CLIENT_ADMIN` clear their own grants (→ unrestricted) or self-grant properties; add a subset-of-caller check and block self-targeting.
- **AUTHZ-WIZ (P2-5):** onboarding wizard routes authenticate but don't authorize — any seat can rename the org / rewrite module flags. Add an owner/admin role gate.
- **TOKEN-CUID:** `app/preview/**` treat a CUID as a bearer capability; move to real random share tokens.
- **WEB-CSP:** drop `unsafe-eval`, move toward nonce-based CSP.
- **WEBHOOK-RESEND:** Svix secret used raw (fails closed today, but bounce/complaint handling may be silently dropping); use the `svix` library and add idempotency.
- **Duplicate SSRF guards** (`lib/audit/site-crawl.ts`) and **cursive shared-secret length oracle** — consolidate onto the central guard / canonical `timingSafeEqual`.

---

## 5. Top ten actions (recommended order)

| # | Action | Why | Effort | Breaking risk | Owner | In-repo? | Acceptance |
|---|---|---|---|---|---|---|---|
| 1 | Deploy the branch's confirmed fixes | Closes 1 Critical + 4 High + 5 Medium | Done | Low | Eng | Yes | Suite green, deployed |
| 2 | External verification (§7) | Several controls only exist outside the repo | M | — | DevOps | No | Checklist signed off |
| 3 | Wire `withSpendCap` + `logUsage` on all Anthropic calls | No hard spend ceiling today (DoW) | M | Low | Eng | Yes | Every model call metered + capped |
| 4 | Replace chatbot Origin trust with a signed server-issued token | Origin header is spoofable; it's the primary control | M | Med (widget change) | Eng | Yes | Public chat/lead require HMAC token |
| 5 | Gate onboarding wizard + team property-access on role (AUTHZ-WIZ, AUTHZ-SELF) | Low-priv seats can tamper entitlements/scope | S | Med | Eng | Yes | Viewer cannot rewrite entitlements; no self-escalation |
| 6 | Harden/gate the demo chatbot (AI-DEMO) | Open LLM proxy on our bill | S | Low | Eng | Yes | Context server-verified + quota + logUsage |
| 7 | Move `app/preview/**` to random share tokens (TOKEN-CUID) | CUID ≠ secret | S | Low | Eng | Yes | Preview requires unguessable token |
| 8 | Tighten CSP (drop `unsafe-eval`, nonce inline) | Shrinks XSS blast radius | M | Med | Eng | Yes | CSP report-only → enforce |
| 9 | Add a lint/test: every `"use server"` export authorizes before Prisma | Root cause of AUTHZ-SA1/SA2 | S | Low | Eng | Yes | CI fails on an unauthorized action export |
| 10 | Fix Resend webhook secret decoding + add idempotency | Compliance events may be silently dropped | S | Low | Eng | Yes | Real events verified + deduped |

---

## 6. Changes completed (this branch)

New file: `lib/security/internal-call.ts` (in-process capability token).

| File | Change | Finding |
|---|---|---|
| `lib/actions/audiences.ts` | `executeSegmentPush` requires `INTERNAL_CALL` | AUTHZ-SA1 |
| `app/api/cron/run-audience-syncs/route.ts` | passes `INTERNAL_CALL` | AUTHZ-SA1 |
| `lib/actions/admin-cursive.ts` | `runCursiveSegmentSync` requires `INTERNAL_CALL` | AUTHZ-SA2 |
| `lib/actions/tenant-pixel-sync.ts`, `app/api/cron/pixel-segment-sync/route.ts`, `scripts/sync-tc-cursive.ts` | pass `INTERNAL_CALL` | AUTHZ-SA2 |
| `lib/site-engine/intake-schema.ts` | pin `blobUrl` to Vercel public-blob host | SSRF-01, XSS-BLOB |
| `app/api/site-requests/[id]/packet/route.ts` | guard asset fetch with central SSRF guard | SSRF-01 |
| `lib/aeo/run-onpage-audit.ts` | route direct fetch through central SSRF guard | SSRF-02 |
| `lib/auth/require-admin.ts` | require `orgType === AGENCY` | AUTHZ-ADMIN |
| `app/api/onboarding/wizard/start-trial/route.ts` | exclude `CANCELED`/`PAUSED` from re-trial | PAY-ENT1 |
| `app/api/site-requests/upload/route.ts` | exact MIME allowlist (no SVG) + pinned content-type | FILE-SVG |
| `app/api/marketplace/auth/request/route.ts`, `.../seller-auth/request/route.ts` | per-IP rate limit | ABUSE-MKT |
| `app/api/tenant/creative-requests/[id]/{status,messages}/route.ts` | `propertyInScope` gate | AUTHZ-PROP |
| `app/api/chat/route.ts` | cross-tenant upsert refusal | CHAT-XT |
| `lib/tenancy/origin-guard.ts` + 3 public routes | `chatbotOriginBypassEnabled()` prod refusal | ORIGIN-PROD |
| `package.json` + `pnpm-lock.yaml` | `next` → `~16.2.12` | SUPPLY-NEXT |

New tests: `__tests__/security-internal-call.test.ts`, `security-intake-blob-url.test.ts`, `security-chatbot-origin-bypass.test.ts`, `security-remediation-invariants.test.ts`; updated `require-admin-clerk-lookup.test.ts`.

**Verification commands & results:** (see §Verification below)

---

## 7. External verification checklist (EXTERNAL_VERIFICATION_REQUIRED)

| Provider | Setting to inspect | Where | Secure expected state | Risk if wrong |
|---|---|---|---|---|
| Clerk | MFA for agency/admin; session lifetime; `CLERK_WEBHOOK_SECRET` | Clerk dashboard | MFA enforced for staff; bounded sessions; secret set | Admin takeover; unverified webhooks |
| Stripe | Webhook signing secret; live-mode; restricted API key | Stripe dashboard | `STRIPE_WEBHOOK_SECRET` set; least-priv key | Forged billing events |
| Neon Postgres | Network access; TLS enforced; runtime role privileges | Neon console | Not public; TLS required; least-priv runtime role | DB exposure; schema tamper |
| Vercel | Env separation (prod/preview); `DEMO_MODE` + `CHATBOT_ALLOW_ANY_ORIGIN` **unset** in prod; source-map exposure | Vercel project | Flags unset in prod; maps hidden | Auth bypass on preview; open chatbot |
| Upstash Redis | Provisioned in prod | Vercel env | `KV_REST_API_URL/TOKEN` set | Rate limiting 429s everything (fail-closed) or disabled |
| Vercel Blob | Public store scope; object listing disabled | Vercel storage | Random keys only; no listing | Enumeration of tenant assets |
| DNS / email | SPF, DKIM, DMARC alignment | DNS + Resend | Aligned | Spoofing / deliverability |
| Cloud IAM | Least-priv for build + runtime | Vercel/cloud | Scoped | Lateral movement |
| GitHub | Branch protection, required reviews, secret scanning, CODEOWNERS on auth/payments/migrations | Repo settings | Enabled | Unreviewed prod code |
| Sentry | Source-map deletion after upload; PII scrubbing | Sentry | Maps deleted; PII off | Source/PII leak |
| Anthropic | Data retention / training / logging | Provider console | Per contract | Prompt/PII retention |

---

## 8. Residual risk

- **Unresolved (product/architecture decisions):** AI denial-of-wallet (AI-DEMO/AI-ORIGIN/AI-COST), onboarding/team role gaps (AUTHZ-WIZ, AUTHZ-SELF), CUID-as-token previews, CSP `unsafe-eval`, Resend webhook decoding. All documented above with fix paths.
- **Not testable from the repo:** everything in §7 (provider config).
- **Depends on production config:** rate-limiting only protects if Upstash is provisioned; `DEMO_MODE`/`CHATBOT_ALLOW_ANY_ORIGIN` must be unset in prod (code now hard-refuses the latter regardless).
- **Requires credential rotation:** none identified (no secret exposure found); rotation only if the External checklist reveals a leaked/over-scoped key.
- **Consciously accepted:** the Cursive per-tenant `[token]` webhook uses a URL-path secret (128-bit, format-gated) — documented tradeoff; the `audit/[id]` shareToken is a lead-gen gate, not a security boundary.

---

## 9. Release-gate verdict

### `CONDITIONAL_RELEASE`

**Rationale.** The one Critical (SSRF-01) and all four High findings (AUTHZ-SA1/SA2, SUPPLY-NEXT, AUTHZ-ADMIN) are **fixed with regression tests**, plus five Medium fixes. No committed secrets; no broad cross-tenant read in the API surface; authentication and payment integrity are sound (server-owned prices/entitlements, verified-event provisioning); AI agents have **no** high-impact tool authority. These clear the hard blockers.

The release is **conditional**, not `READY`, because:
1. **Critical external configuration is unverified** (§7) — auth MFA, webhook secrets, DB network posture, and the prod-unset state of `DEMO_MODE` cannot be proven from the repo, and a `DEMO_MODE=true` on any internet-reachable non-prod deploy is a total auth bypass.
2. Two **Medium self-service entitlement/authorization gaps remain open by design decision** (AUTHZ-WIZ, AUTHZ-SELF) — they need a product call on the onboarding/team role model before they can be safely gated.
3. The **AI denial-of-wallet** exposure (no hard spend ceiling; spoofable origin) is a real cost/availability risk on shared budgets that should be closed before heavy public exposure.

Once §7 is signed off and items 3–6 of the Top-10 are addressed, this moves to `READY_FOR_RELEASE`.

---

## Verification (Phase 4)

Commands run locally on this branch (tool versions: node v22.22.2, pnpm 10.33.0, vitest 4.0.18, tsc 5.7.x, Next 16.2.12):

| Check | Command | Result |
|---|---|---|
| Install | `pnpm install` | OK |
| Unit/integration suite | `pnpm test` (vitest) | **PASS** — 220 files / 2200+ tests green (incl. 5 new security tests) |
| Type check | `pnpm type-check` (`tsc --noEmit`) | **PASS** — 0 errors |
| Lint (changed files) | `pnpm exec eslint <changed>` | **PASS** — 0 problems |
| Dependency audit | `pnpm audit --prod` | 32 high / 77 moderate / 12 low — **all transitive**; the one runtime-relevant High (`next` App Router advisories) is remediated by the 16.2.12 bump. Remainder are dev/build-only (prisma→@prisma/dev→hono, sentry build plugins, posthog→otlp→protobufjs) or non-exploitable paths (undici WebSocket vulns via cheerio/@vercel/blob, which don't use undici's WS client). |
| Secret scan | git history + working-tree pattern sweep | **PASS** — no secrets committed; `.env.example` placeholders only |
| Production build | `next build` | Requires provider env (DATABASE_URL, Clerk); not run in this sandbox — see External Verification. Typecheck+lint+tests cover static correctness. |

Regression tests added: `security-internal-call`, `security-intake-blob-url`, `security-chatbot-origin-bypass`, `security-remediation-invariants`; updated `require-admin-clerk-lookup` and `cursive-segment-sync-property-stamp`. These cover TEST-11/12/13/14 (authz), TEST-22 (upload types), TEST-29 (SSRF), and the two Server-Action authorization fixes.

---

## Appendix — Complete checklist matrix

Status legend: **PASS** (control present + evidenced), **FAIL** (confirmed gap; suffix →FIXED if remediated on this branch), **PARTIAL**, **N/A** (not applicable, reason given), **EXT** (external-verification required), **INFO**.

### A. HTTPS / headers / web config
| ID | Status | Note |
|---|---|---|
| WEB-01 | EXT | HTTPS + redirect enforced at Vercel/edge (platform) |
| WEB-02 | PASS | HSTS `max-age=63072000; includeSubDomains; preload` (`next.config.mjs`) |
| WEB-03 | PASS | No mixed content; assets from https CDN |
| WEB-04 | PASS | State-changing cookie APIs are marketplace SameSite=lax sessions + Next Server-Action origin check |
| WEB-05 | PASS | Mutations are POST/PATCH/DELETE; no GET side effects found |
| WEB-06 | PASS | OAuth state uses signed cookie + `timingSafeEqual` |
| WEB-07 | PASS | `requireMatchingOrigin` on public endpoints |
| WEB-08 | PASS | CORS wildcard only on PII-free embed endpoints; no arbitrary reflection |
| WEB-09 | PASS | No `Access-Control-Allow-Credentials` anywhere (grep-confirmed) |
| WEB-10 | PARTIAL | Methods/headers set on embeds; `Vary: Origin` not explicit |
| WEB-11 | PASS | Full CSP present |
| WEB-12 | FAIL (Low) | `script-src 'unsafe-inline' 'unsafe-eval'` — WEB-CSP, proposed |
| WEB-13 | PASS | `frame-ancestors 'none'` + `X-Frame-Options: DENY` |
| WEB-14 | PASS | `X-Content-Type-Options: nosniff` |
| WEB-15 | PASS | `Referrer-Policy: strict-origin-when-cross-origin` |
| WEB-16 | PASS | `Permissions-Policy: camera=(), microphone=(), geolocation=()` |
| WEB-17 | N/A | No cross-origin isolation requirement |
| WEB-18 | PASS | Authenticated pages `force-dynamic`, no public caching |
| WEB-19 | EXT | CDN cache-key separation (Vercel) |
| WEB-20 | PASS | No directory listing (Next app) |
| WEB-21 | PARTIAL | Legacy template routes redirected; `health/deep` exposes org count (INFO) |
| WEB-22 | PASS | `poweredByHeader:false` |
| WEB-23 | N/A | Third-party scripts loaded from allowlisted CDNs; SRI not applicable to Clerk/Stripe SDKs |
| WEB-24 | PASS | `sanitize-content-html` allowlist at every `dangerouslySetInnerHTML`; JSON-LD escaped |
| WEB-25 | PASS | Sensitive links built from `getSiteUrl()`/canonical origin, not Host header |

### B. Authentication & recovery
| ID | Status | Note |
|---|---|---|
| AUTH-01 | PASS | Server-side gates on every non-public resource |
| AUTH-02 | PARTIAL→FIXED | `requireAdmin` orgType gap fixed; DEMO_MODE prod-refused; middleware header-strip |
| AUTH-03..24 | EXT | Login/enumeration/MFA/reset/OAuth handled by **Clerk** (managed IdP) — verify dashboard policy (MFA for staff, session lifetime, exact redirect URIs). No custom password storage in repo (AUTH-07/08 N/A). AUTH-22: no dev backdoors found (`grant-agency-access`/`promote` scripts are CLI-only, not route-reachable) |

### C. Session / cookie / JWT / token
| ID | Status | Note |
|---|---|---|
| SESS-01..09 | EXT/PASS | Clerk-managed session cookies (Secure/HttpOnly/SameSite); marketplace sessions set `httpOnly, secure, sameSite:lax` |
| SESS-10 | PARTIAL | Cursive `[token]` webhook uses URL-path secret (documented tradeoff) |
| SESS-11 | PASS | Sentry scrubs headers/PII; tokens not logged |
| SESS-13..18 | EXT | JWT validation is Clerk-internal |
| SESS-19 | PASS | API keys scoped/revocable/expirable, SHA-256 verifier |
| SESS-20 | EXT | Session listing/revocation via Clerk |

### D. Authorization / tenancy
| ID | Status | Note |
|---|---|---|
| AUTHZ-01 | PASS | Server-side on every protected action |
| AUTHZ-02 | PASS | Deny-by-default (`requireScope` throws) |
| AUTHZ-03 | PASS | No horizontal IDOR found (scoped `findFirst` then update-by-id) |
| AUTHZ-04 | PARTIAL→FIXED | requireAdmin orgType (fixed); AUTHZ-WIZ/SELF proposed |
| AUTHZ-05 | PASS | Object-level checks on `[id]` routes |
| AUTHZ-06 | PASS | orgId derived from session/key, never body (except server-action gap, fixed) |
| AUTHZ-07 | PARTIAL | No `data:{...body}`; AUTHZ-WIZ lets low-priv seat write module flags (proposed) |
| AUTHZ-08 | PASS | Serializers project public-safe fields |
| AUTHZ-09 | PASS | tenant isolation across queries/storage/search |
| AUTHZ-10 | PARTIAL→FIXED | Server-action cross-tenant paths fixed (AUTHZ-SA1/SA2) |
| AUTHZ-11 | PASS | Invite flow layered auth (`clients/invite`) |
| AUTHZ-12 | PASS | Signed URLs scoped/expiring |
| AUTHZ-13 | PASS | Crons/jobs carry explicit orgId server-side |
| AUTHZ-14 | EXT | Service identities (cloud IAM) |
| AUTHZ-15 | PASS | Server-side gates, not UI hiding |
| AUTHZ-16 | PARTIAL | 50k-row PII export lacks export-specific limiter (INFO) |
| AUTHZ-17 | PASS | Impersonation audited + session-bound (cap not enforced — IMP-CAP, Low) |
| AUTHZ-18 | PASS | Revoked share tokens deleted; deleted rows scoped |

### E. Input / output / injection
| ID | Status | Note |
|---|---|---|
| INPUT-01..03 | PASS | Zod schemas at trust boundaries; size/length caps |
| INPUT-04 | PASS | Parameterized Prisma; raw SQL only tagged-template or CLI scripts |
| INPUT-05 | PASS | No attacker-controlled dynamic identifiers reachable |
| INPUT-06 | PASS | No `child_process`/exec in runtime |
| INPUT-07 | PASS | No SSTI (emails use escaped interpolation) |
| INPUT-08/09/10/11 | PASS | Framework escaping; allowlist sanitizer; no unsafe sinks |
| INPUT-12 | PARTIAL→FIXED | SSRF-01 (packet) + SSRF-02 (AEO) fixed; central guard elsewhere |
| INPUT-13 | PASS | Central guard covers protocol/redirect/IPv4+6/metadata |
| INPUT-14 | PASS | Server-controlled blob keys; filename sanitized |
| INPUT-15 | N/A | No untrusted XML parsing |
| INPUT-16 | PASS | No native deserialization of untrusted data |
| INPUT-17 | PASS | No unsafe object-merge/path-assign of untrusted input |
| INPUT-18/19 | PASS | No CRLF/header/email-header injection paths |
| INPUT-20 | PASS | Open-redirect guarded (`next` prefix-checked, signed state) |
| INPUT-21 | INFO | CSV export formula-injection not hardened (Low) |
| INPUT-22 | PASS | No attacker-controlled regex compile found |
| INPUT-23 | PASS | No eval/new Function in runtime |
| INPUT-24 | EXT | Reverse-proxy smuggling (Vercel) |
| INPUT-25 | PASS | Generated keys/identifiers validated |
| INPUT-26 | PASS | Model/DB values treated as untrusted at render (sanitized) |

### F. File upload / storage
| ID | Status | Note |
|---|---|---|
| FILE-01 | PARTIAL→FIXED | site-requests/upload now exact allowlist (no SVG); other paths already exact |
| FILE-02/03 | PARTIAL | MIME/extension checked; no magic-byte sniffing (FILE-05 Low) |
| FILE-04/05 | PARTIAL | Size caps present; decompression-bomb limits N/A (no archive extraction of uploads) |
| FILE-06 | PASS | Server-controlled keys + `addRandomSuffix` |
| FILE-07/08 | PASS→FIXED | Public blob is separate origin; SVG/HTML now blocked; content-type pinned |
| FILE-09 | INFO | No malware scanning (risk-accepted for image/pdf) |
| FILE-10 | INFO | No metadata stripping |
| FILE-11 | PASS | Download/preview authorized (hero-image scoped) |
| FILE-12 | PASS | Content-Type/Disposition safe |
| FILE-13 | EXT | Blob store listing disabled (verify) |
| FILE-14 | PASS | Presigned URLs scoped/expiring |
| FILE-15 | PASS | Random keys prevent overwrite |
| FILE-16 | N/A | No server-side media transcoding of untrusted input beyond `sharp` (Next) |
| FILE-17 | PARTIAL | Deleted-file CDN purge — EXT |

### G. API / webhook / GraphQL / WS
| ID | Status | Note |
|---|---|---|
| API-01 | PASS | 216 route files inventoried |
| API-02 | PASS→FIXED | Non-public endpoints authenticated (server-action gap fixed) |
| API-03 | PASS→FIXED | Object/function/property-level authz (creative-request property RBAC fixed) |
| API-04..07 | PASS | Zod schemas; body-size caps; pagination on lists |
| API-08 | PASS→FIXED | Rate limits broad; marketplace magic-link added |
| API-09 | PASS | Outbound fetch timeouts (AbortSignal) |
| API-10 | PASS | Idempotency on Stripe events / proposals |
| API-11/12 | PASS | Scoped keys; never in query string |
| API-13/14/15/16 | PASS | Webhook sig verify on raw body, replay/idempotent, fail-closed |
| API-17 | PASS→FIXED | Outgoing webhook SSRF guarded (audiences delivery) |
| API-18/19/20 | N/A | No GraphQL |
| API-21/22/23 | N/A | No app WebSocket server (ws is a dev/test dep) |
| API-24 | INFO | Dead `tenant/listings` route (header-trust pattern; always 404s) — recommend delete |
| API-25 | PASS | Errors generic; no stack/SQL leakage |

### H. Payments / entitlements
| ID | Status | Note |
|---|---|---|
| PAY-01/02 | PASS | Prices/entitlements server-owned; client hints ignored |
| PAY-03/04 | PASS | Stripe sig verify + env/customer/amount checks |
| PAY-05 | PASS | Success page is read-only; return validated against customer+org |
| PAY-06/07 | PASS | Replay/idempotency via `ProcessedStripeEvent` |
| PAY-08 | PASS | Refund/adjust behind requireAgency + audit |
| PAY-09/10 | PARTIAL→FIXED | Re-trial self-grant fixed; coupon/race abuse not exhaustively tested (runtime) |
| PAY-11 | PASS | Lifecycle events update access |
| PAY-12 | PASS | No raw card data stored (Stripe-hosted) |
| PAY-13/14 | PASS | Financial changes audited |

### I. AI / LLM / agents
| ID | Status | Note |
|---|---|---|
| AI-01/02 | PASS | Untrusted content in user role; instructions in system role; KB framed as data |
| AI-03/04 | PASS | No model-gated authz; permissions enforced outside model |
| AI-05..13 | N/A | **No tool-calling/function-calling anywhere** — no agent tools to scope |
| AI-14/15 | PASS | RAG/KB double-scoped by orgId; no cross-tenant retrieval |
| AI-16/17 | PASS | No secrets/system-prompt-as-boundary in context |
| AI-18 | PASS | Model output sanitized before HTML render |
| AI-19/20/21 | PARTIAL | Per-request + per-org-day caps exist; **no hard spend cap** (AI-COST proposed) |
| AI-22 | PARTIAL | No circuit-breaker/kill-switch |
| AI-23/24 | PASS | Memory scoped; provenance on retrieved content |
| AI-25 | PASS | Models/prompts pinned in code |
| AI-26/27 | EXT | Provider retention/telemetry redaction (verify) |
| AI-28 | PARTIAL | Some usage logged; chat routes skip `logUsage` (AI-COST) |
| AI-29/30/31 | PASS | Injection can't reach tools (none exist) or cross-tenant data |
| AI-32/33/34 | PASS | No policy bypass on fallback; bounded objective; deterministic controls outside model |
| (demo) | FAIL (Med) | AI-DEMO open proxy — proposed |
| (origin) | FAIL (Med) | AI-ORIGIN spoofable header — proposed |

### J. Database / storage
| ID | Status | Note |
|---|---|---|
| DATA-01/02/03 | EXT | Neon role privileges — verify least-priv runtime role |
| DATA-04/05 | EXT | DB not public; TLS (Neon serverless driver uses TLS) |
| DATA-06/07/08 | PASS | App-layer tenant scoping (no RLS reliance); Prisma; no anon BaaS client |
| DATA-09 | PARTIAL | 50k export cap present; some unbounded reads (INFO) |
| DATA-10 | PASS | Vault fields app-encrypted (envelope) |
| DATA-11/12/13 | EXT | Backups/replicas/preview data protection |
| DATA-14 | PASS | Migrations reviewed; no public-grant defaults |
| DATA-15/16/17 | PARTIAL/EXT | Retention + audited privileged ops (partly external) |

### K. Secrets / crypto
| ID | Status | Note |
|---|---|---|
| SECRET-01/02/03 | PASS | No committed secrets (tree+history); `.env.example` placeholders; gitignore correct |
| SECRET-04 | PASS | No server secret has `NEXT_PUBLIC_` prefix |
| SECRET-05/06/07/08 | EXT | Vercel env store; per-env separation; rotation procedures |
| SECRET-09/10/11 | PASS | AES-256-GCM, random IV/DEK, `crypto.randomBytes` for tokens |
| SECRET-12 | PASS | No TLS verification disabled |
| SECRET-13 | PASS | `timingSafeEqual` for signatures/secrets (one Low length-oracle in cursive shared-secret) |
| SECRET-14 | PARTIAL | KEK/DEK rotation documented; signing-key rotation EXT |
| SECRET-15/16 | PASS/EXT | Secrets absent from logs/URLs; shared-cred review EXT |

### L. Supply chain
| ID | Status | Note |
|---|---|---|
| SUPPLY-01 | PASS | `pnpm-lock.yaml` committed |
| SUPPLY-02/03 | PASS→FIXED | `pnpm audit` run; `next` High fixed; rest transitive/non-exploitable |
| SUPPLY-04 | INFO | Some outdated transitive deps (dev/build) |
| SUPPLY-05..12 | PARTIAL/EXT | `onlyBuiltDependencies` allowlist present; SBOM/provenance EXT |
| SUPPLY-13/14/15 | EXT | Install-script secret isolation, dependabot policy (CI) |

### M. Infrastructure
| ID | Status | Note |
|---|---|---|
| INFRA-01 | PASS | No debug/console in prod |
| INFRA-02/03 | EXT | Env/preview separation; preview protection |
| INFRA-04 | PASS | No default creds/sample apps |
| INFRA-05 | PASS→FIXED | Admin routes MFA(EXT)+requireAgency/requireAdmin(orgType fixed) |
| INFRA-06..12 | EXT | Cloud IAM / networking / proxy trust |
| INFRA-13 | INFO | `health/deep` org-count disclosure |
| INFRA-14 | EXT | Source-map exposure (Sentry) |
| INFRA-15/16/17/18 | EXT | DNS takeover, WAF, IaC scan, backups |
| INFRA-19 | PARTIAL | Env validation warn-only (documented); rate-limit fails closed in prod |
| INFRA-20 | EXT | Time sync (platform) |

### N. CI/CD
| ID | Status | Note |
|---|---|---|
| CICD-01..16 | EXT | Branch protection, CODEOWNERS, secret/SAST/dep scanning, OIDC deploy creds — verify GitHub/Vercel settings; repo ships lockfile + test suite that CI can gate on |

### O. Logging / monitoring
| ID | Status | Note |
|---|---|---|
| LOG-01/02/03/04 | PASS | Auth/role/financial/impersonation events audited (`AuditEvent`, `CredentialAccessLog`) |
| LOG-05/06 | PASS | No secrets/PII in logs; Sentry scrubs |
| LOG-07 | PASS | Structured logging (no multiline injection surface found) |
| LOG-08 | PASS | Actor/tenant/action/result recorded |
| LOG-09/10 | EXT | Audit-log immutability/retention (DB/infra) |
| LOG-11/12/13/14 | EXT | Alerting destinations + IR runbook (external) |

### P. Rate limiting / abuse
| ID | Status | Note |
|---|---|---|
| ABUSE-01 | PASS | Body-size caps (3MB webhooks, 25/64KB uploads/ingest) |
| ABUSE-02 | PASS→FIXED | Broad per-endpoint limits; marketplace magic-link added |
| ABUSE-03 | PASS | No attacker-triggerable permanent lockout |
| ABUSE-04 | PASS | Per-IP/user/org/key limiters |
| ABUSE-05 | PARTIAL | AI token/output caps; no hard spend cap (AI-COST) |
| ABUSE-06 | PASS | Query timeouts/pagination |
| ABUSE-07/08 | PASS | Cron caps + reaper; bounded retries |
| ABUSE-09 | PARTIAL | Some circuit-breaking; not universal |
| ABUSE-10 | PASS | Idempotency/dedupe |
| ABUSE-11 | PARTIAL | Body caps; no archive/image-bomb specific limits |
| ABUSE-12 | PASS | Cache keys bounded (edge s-maxage) |
| ABUSE-13 | PARTIAL | Signup/lead limiters; scraping partial |
| ABUSE-14 | PARTIAL | Per-org limiters; shared AI budget is the gap (AI-COST) |
| ABUSE-15 | PARTIAL | Cost-aware limits on expensive endpoints (audit/zillow); AI spend gap |

### Q. Privacy
| ID | Status | Note |
|---|---|---|
| PRIV-01..04 | PASS | PII inventoried; scoped; not in URLs/logs |
| PRIV-05/06 | PARTIAL/EXT | Retention/deletion partly external |
| PRIV-07 | PARTIAL | Exports authorized but no reauth/export-limiter (INFO) |
| PRIV-08/09/10/11/12 | EXT | Third-party SDK data flows, prod-data-in-nonprod, backup access — verify |

### R. Admin / support / internal
| ID | Status | Note |
|---|---|---|
| ADMIN-01/02 | EXT | MFA/reauth for admin (Clerk) |
| ADMIN-03/04 | PASS | Role tiers (AGENCY_OWNER/ADMIN/OPERATOR); no god-mode beyond owner |
| ADMIN-05 | PASS | Impersonation justified/audited/session-bound (cap not enforced — IMP-CAP) |
| ADMIN-06/07/08 | PASS→FIXED | Bulk/internal endpoints gated (requireAgency/requireAdmin orgType fixed) |
| ADMIN-09/10/11/12 | EXT | Admin session policy, alerting, offboarding, manual accounts |

### S. Email / SMS / links
| ID | Status | Note |
|---|---|---|
| MSG-01 | PASS | Links from canonical origin |
| MSG-02/03 | PASS | Scoped/expiring tokens; not leaked via referer |
| MSG-04 | PASS | Enumeration-safe responses (marketplace) |
| MSG-05 | PASS→FIXED | Reset/OTP/magic-link limited (marketplace added) |
| MSG-06 | PASS | Escaped email templates |
| MSG-07 | EXT | Email-change reauth (Clerk) |
| MSG-08 | PASS | No open redirect in outbound links |
| MSG-09 | PASS | No reusable creds in notifications |
| MSG-10 | EXT | SPF/DKIM/DMARC (DNS) |
| MSG-11/12 | EXT | OTP/recovery policy (Clerk) |

### T. Clients (mobile/desktop/extension)
| ID | Status | Note |
|---|---|---|
| CLIENT-01..12 | N/A | Web-only product; no distributed client apps. Server-side authz holds regardless of client (CLIENT-10 PASS) |

### U. Error handling / secure defaults
| ID | Status | Note |
|---|---|---|
| ERROR-01/02/03 | PASS | Generic errors; no stack/SQL/secret leakage; server-side correlation |
| ERROR-04 | PASS | Fail-closed on auth/sig/policy errors |
| ERROR-05 | PASS | Unsupported methods/content-types rejected |
| ERROR-06 | PARTIAL | Env validation warn-only (marketing-uptime tradeoff); rate-limit + KEK fail closed |
| ERROR-07 | PASS | No catch-all authz bypass found |
| ERROR-08 | PASS | Degraded fallbacks don't bypass access control |

### Phase-1/4 discovery + test controls
| ID | Status | Note |
|---|---|---|
| DISC-01..12 | PASS | Architecture mapped (§2) |
| TEST-01..10 | PASS | Suite/typecheck/lint/audit/secret-scan run (Verification table); build EXT |
| TEST-11..14 | PASS | Authz regression tests added (require-admin orgType, server-action tokens, property RBAC) |
| TEST-15 | PASS | Mass-assignment bounded (no `data:{...body}`) |
| TEST-16 | PASS | CSRF via SameSite + Next origin check |
| TEST-17/18/19 | EXT | Reset-token/session behavior is Clerk-managed |
| TEST-20/21/22 | PASS | Rate-limit + oversized + disallowed-upload tests present |
| TEST-23 | PASS | Download authz (hero-image scope) |
| TEST-24/25 | PASS | Webhook sig required + replay idempotent |
| TEST-26 | PASS | Client prices ignored (billing tests) |
| TEST-27 | EXT | JWT validation (Clerk) |
| TEST-28 | PASS | CORS no credentialed reflection |
| TEST-29 | PASS | SSRF blocks private/metadata (guard tests + new AEO/packet routing) |
| TEST-30 | PASS | Output encoded/sanitized |
| TEST-31/32/33 | PASS/PARTIAL | No AI tools to exceed perms; injection can't reach cross-tenant data; spend bound is soft (AI-COST) |
| TEST-34 | PASS | Security events logged without secrets |
