# LeaseStack Security Audit — May 2026

Methodology: 4 parallel `security-reviewer` agent passes across distinct
attack surfaces, plus `pnpm audit` for dependency CVEs, plus an OWASP
Top-10 skill (`owasp-audit`) from
[github.com/coreyhaines31/cybersecurity-skills](https://github.com/coreyhaines31/cybersecurity-skills).
Agents covered: (1) auth + tenant scoping, (2) API routes + webhooks,
(3) SSRF + XSS + injection, (4) secrets + crypto + logging + headers.

## TL;DR — Overall Posture

Strong. **No critical IDORs. No SQL injection. No XSS. All webhooks
signature-verified. Crypto is textbook-correct (AES-256-GCM, random IV,
auth tag verified). Headers comprehensive (HSTS, CSP, frame-ancestors,
nosniff). No hardcoded secrets in source.**

The material risk surface is on **property-level RBAC enforcement** —
portal pages enforce `UserPropertyAccess`, but several JSON APIs only
enforce `tenantWhere(scope)` and let property-restricted users widen
access via the API. Plus two role-gate gaps on settings/billing
mutations.

## What Was Shipped This Session

| # | Severity | Finding | Fix |
|---|---|---|---|
| 1 | CRITICAL CVE | `@clerk/nextjs@6.38.2` had middleware-based route protection bypass | Bumped to `7.3.4` (patched) |
| 2 | HIGH CVE | `next@16.1.6` had DoS via Server Components + cache poisoning | Bumped to `16.2.6` (patched) |
| 3 | HIGH | SSRF in property-image scraper — operator-controlled URL fetched without private-IP blocking | `lib/property-images/scrape.ts` — gated through `isAllowedUrlWithDns`, manual redirect handling with per-hop re-validation, content-type guard |
| 4 | HIGH | `/api/portal/marketplace/toggle` accepted any role — `CLIENT_VIEWER` could flip paid module flags | Role gate added (owner/admin/agency only) |
| 5 | MEDIUM | `/api/tenant/settings` PATCH allowed any role to change `primaryContactEmail` (lead-notification inbox) and rebrand the org | Role gate added (owner/admin/agency only) |
| 6 | MEDIUM | Rate limiter failed OPEN in production when Upstash env vars missing | `lib/rate-limit.ts` — fail CLOSED in `NODE_ENV === "production"` |
| 7 | MEDIUM | Sentry had no `beforeSend` PII scrubber; replay didn't mask text/inputs/media | All 3 sentry configs now scrub sensitive headers + query params, drop request bodies, mask all text + inputs + media in Session Replay, drop production console breadcrumbs |

TypeScript clean after every patch.

## Open Backlog — Ranked Follow-Ups

### HIGH — Must fix before next deploy

**B1 · Property-RBAC bypass on lead list/export/bulk-actions**
- Files: `app/api/tenant/leads/route.ts`, `app/api/tenant/leads/export/route.ts`, `lib/actions/lead-bulk.ts`
- Vector: A `CLIENT_VIEWER` or `LEASING_AGENT` with `UserPropertyAccess` restricted to Property A can call `GET /api/tenant/leads` or `GET /api/tenant/leads/export` and receive Property B's leads. Bulk mutations (`bulkUpdateLeadStatus`, `bulkDeleteLeads`) can also touch leads outside the user's allowed property set.
- Fix: Spread `propertyWhereFragment(scope, null)` into every Prisma `where` that joins through `Lead.propertyId`. For bulk mutations, intersect submitted `leadIds` with leads whose `propertyId ∈ scope.allowedPropertyIds` before the write.

**B2 · Same RBAC bypass on visitors export + property lifecycle bulk + reports**
- Files: `app/api/tenant/visitors/export/route.ts`, `lib/actions/properties.ts:setPropertyLifecycleBulk`, `app/api/portal/reports/route.ts`
- Same vector + fix shape as B1. `setPropertyLifecycleBulk` should mirror the single-property `setPropertyLifecycle` pattern (which already intersects with `scope.allowedPropertyIds`).

**B3 · Agency role-management lateral escalation**
- File: `lib/actions/manage-team.ts:updateUserRoleAsAgency`, `removeUserFromOrgAsAgency`
- Vector: Any `AGENCY_OPERATOR` can call `updateUserRoleAsAgency({ userId: <another agency user>, role: AGENCY_OWNER })` and self-promote, or remove the only existing `AGENCY_OWNER`. There's no rank check.
- Fix: Require caller role ∈ `{AGENCY_OWNER, AGENCY_ADMIN}` when target is agency. Refuse to demote or delete the last `AGENCY_OWNER`.

### MEDIUM — Schedule for this week

**B4 · `/api/admin/clients/invite` uses `requireScope()` instead of `requireAgency()`**
- File: `app/api/admin/clients/invite/route.ts`
- Currently safe (handler re-discovers role) but structurally a foot-gun for any regression. Split into agency + client routes.

**B5 · IP spoofing via `X-Forwarded-For`**
- File: `lib/rate-limit.ts:getIp`
- Reads first XFF value blindly. On Vercel this is trusted, but document the trust model and prefer `request.ip` where available.

**B6 · Cal.com webhook lacks rate-limit + body size cap**
- File: `app/api/intake/[id]/cal-booked/route.ts`
- HMAC-verified, so signature forgery is gated. Add `webhookLimiter` + 3 MB cap to match the other 5 verified webhook handlers.

**B7 · `unsafe-eval` in CSP**
- File: `next.config.mjs`
- Audit dependencies for who actually needs `eval`. Removing it tightens XSS defense. Nonce-based CSP via middleware is the long-term fix.

### LOW — Hardening backlog

- **L1** `chatbot/inbox` is unauthenticated by `sessionId` (UUID v4). Acceptable but sign sessionIds with HMAC for defense-in-depth.
- **L2** Public chatbot `/api/public/chatbot/chat` lacks the `requireMatchingOrigin` guard that `/api/chat` has. Spoofable Origin still bills our Anthropic budget on the right tenant key.
- **L3** `cancelPixelRequest` doesn't pre-load + audit prior state before update.
- **L4** Bug-report endpoint lacks per-user rate limit (authenticated only, low blast radius).
- **L5** Open redirect defense at `oauth-handler.ts` is correct but worth a regression test.
- **L6** Consider adding `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Resource-Policy: same-site` to the security header set.
- **L7** Add the impersonation 8h age cap that's stamped at `impersonateStartedAt` but never read.

## Remaining Dependency CVEs

After the Clerk + Next bumps, the audit went from **3 critical / 30 high
→ 1 critical / 15 high**. The remaining ones are mostly transitive
through dev/test dependencies (vitest → jsdom → undici, prisma → @prisma/dev → hono).
The 1 remaining "critical" is `protobufjs` arbitrary code execution
through a transitive in the Sentry SDK chain — patchable via `pnpm up @sentry/nextjs@latest` or a `pnpm.overrides` pin.

Run `pnpm audit` weekly. Pin overrides for transitive criticals in `package.json`:

```json
"pnpm": {
  "overrides": {
    "serialize-javascript@<6.0.2": ">=6.0.2",
    "protobufjs@<7.2.5": ">=7.2.5",
    "undici@<6.21.2": ">=6.21.2"
  }
}
```

## Verified Clean (No Findings)

- SQL injection — all `$queryRaw` calls use tagged templates; `$queryRawUnsafe` calls (2 in `lib/reports/generate.ts`) use positional bind parameters
- XSS — all `dangerouslySetInnerHTML` uses are static content (JSON-LD, print CSS); chatbot `renderMarkdown` HTML-escapes before regex substitution and runs in a shadow DOM
- Command injection — no `exec`/`spawn`/`child_process` in app or lib code
- Prototype pollution — no `lodash.merge` or `Object.assign` with untrusted sources
- Path traversal — no `fs.readFile`/`fs.writeFile` with user-derived paths in `app/`
- Open redirects — `oauth-handler.ts` defends in depth (rejects `//`, requires `/portal/` prefix)
- AI prompt injection — chatbot system prompt is fixed; user messages flow into `messages`, never `system`
- Hardcoded secrets — none in tracked source; `.gitignore` correct; only `.env.example` is tracked
- Webhook signature verification — Stripe, Clerk (Svix), Cursive (token + HMAC), Resend, Cal.com — all use `timingSafeEqual` or `constructEvent`. Resend fails closed when secret unset
- Mass assignment — every POST/PUT/PATCH sampled uses `zod.safeParse` before Prisma writes
- Cron auth — every `/api/cron/*` route gates on `verifyCronAuth` (constant-time bearer compare)
- Crypto — AES-256-GCM, random 12-byte IV per encryption, 16-byte auth tag verified, key from `ENCRYPTION_KEY` (32-byte hex enforced)
- Cookies — only one custom cookie (OAuth state), set `httpOnly + secure + sameSite=lax + maxAge=600`. Clerk handles all session cookies
- Security headers — HSTS w/ preload, full CSP, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, `poweredByHeader: false`
- IDOR on `[id]` routes — uniformly use `findFirst({ where: { id, ...tenantWhere(scope) } })` pattern

## Recommended Follow-Up Tooling

Beyond the `cybersecurity-skills` repo already installed, the highest-ROI additions for a Next.js + Prisma + Clerk SaaS:

1. **`semgrep` (github.com/semgrep/semgrep)** — Static analysis with a Next.js + React + TypeScript ruleset. Catches a different class of bug than agent-based review (typed-pattern matching, much faster on CI). Run weekly in CI: `semgrep --config p/typescript --config p/owasp-top-ten --config p/react`.

2. **`socket.dev` GitHub app** — Supply-chain attack detection. Flags malicious npm publishes (typosquats, install scripts, telemetry exfil) before they land in your lockfile. Free for OSS, paid for private. Complements `pnpm audit` (CVEs only).

3. **`snyk` or `dependabot`** — Automated PRs for vulnerable transitive dependencies. Dependabot is free and built into GitHub. Configure for weekly grouped PRs.

4. **`detect-secrets` (Yelp)** — Pre-commit hook that blocks accidental secret commits. `pip install detect-secrets && detect-secrets scan > .secrets.baseline`. Wire into Husky.

5. **`gitleaks` (gitleaks.io)** — Historical secret scan of the full git history. Run once now to confirm nothing leaked in the past. `gitleaks detect --source . --verbose`.

6. **Burp Suite Community (free) / OWASP ZAP** — Manual + automated dynamic scan against a staging deploy. Catches what static review can't: auth flow flaws, session fixation, broken access control via request tampering.

7. **`pentest-tools.com` external scan** — Once we have a stable production hostname, run an external infra/network scan: open ports, TLS config, cert validity, DNS misconfig, exposed admin panels. Free tier covers the basics.

8. **Cloudflare WAF in front of `leasestack.co`** — managed rule sets for common application attacks (SQLi, XSS, common scanners) sit upstream of our Vercel functions. Free plan includes the OWASP Core Rule Set.

9. **A bug bounty / responsible disclosure page** — `/security.txt` (RFC 9116) at the root: `mailto:security@leasestack.co`, expiration date, PGP key. Costs nothing and signals seriousness to anyone who finds an issue.

## Ownership + Cadence

- This audit: a snapshot of the codebase as of May 2026.
- **Re-run after every Clerk/Next major bump** — auth boundaries are the most likely place for regressions.
- **Re-run quarterly** even with no major changes — new dependencies, new endpoints, new role types accumulate risk.
- **Re-run after any incident** that touches authentication, billing, or tenant scoping.

End of audit.
