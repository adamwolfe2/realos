# SG Real Estate Hardening Pass — 2026-05-19

Session goal: Friday launch of SG Real Estate. Tighten and harden everything. Same UI as Telegraph Commons demo, but real data.

## What got done

### 1. Toggle UI — fixed
`app/admin/clients/[id]/module-toggle.tsx` — ON state now `bg-blue-600` (was a barely-visible `bg-primary/5`). Off state unchanged.

### 2. Module parity — fixed
The admin panel toggled 11 modules; the portal nav exposed 30+ features. New schema fields + migration + admin toggles + portal gating:

**New modules on `Organization`** (default false, NOT NULL):
- `moduleReputation`
- `moduleInsights` (AEO + briefing + reports — one intelligence pipeline)
- `moduleAttribution`
- `moduleResidents` (residents + renewals + work-orders + applications — all AppFolio-backed)
- `moduleTours`
- `moduleConversations`

**Migration**: `prisma/migrations/20260520_module_parity/migration.sql` (not yet applied to prod — review and run when ready).

**Admin toggle list** now shows all 19 modules grouped by intent (Acquisition / Paid+Organic / Email Lifecycle / Intelligence / Operations / Add-ons).

**Portal gating**: 12 routes now use `requireModule()` (new helper `lib/portal/module-gate.tsx`) and render an in-page upsell when the module is off. Nav items in `portal-nav.tsx` hide accordingly.

### 3. Embed hardening — bug fixed
- **Bug**: POST_CHAT chatbot lead capture sent the Resend email but missed the in-app bell notification (despite a prior-session claim that this was fixed). Now fixed in `app/api/public/chatbot/chat/route.ts`.
- **Install doc**: `docs/SG_REAL_ESTATE_EMBED_INSTALL.md` — exact `<script>` tags for SG, DevTools verification, search-and-replace pattern for old popup tags, 4 production cURL smoke tests.
- Embed snippets for SG (slug = `sg-real-estate`):
  - Chatbot in `<head>`: `<script src="https://www.leasestack.co/embed/chatbot.js" data-slug="sg-real-estate" defer></script>`
  - Popup before `</body>`: `<script async src="https://www.leasestack.co/embed/popup.js" data-tenant="sg-real-estate"></script>`
- **NOTE**: SG's current slug is actually `telegraph-commons` (see "Open decisions" below). If we keep it, use `telegraph-commons` in the snippet instead.

### 4. SEO / GA4 / AEO / Reputation — audited + fixed
- **AEO graceful degradation**: `/portal/seo/aeo` cards now show "Not configured — API key missing on server" with `opacity-60` instead of misleading "No queries yet". `/api/portal/seo/aeo/scan` returns 503 with clear message when zero engines configured.
- **Reputation scan errors no longer swallowed**: `source_failed` events from the orchestrator bubble to the UI as "X source failures (tavily, yelp)".
- **GA4/GSC connection pills** already reflect honest health (`classifyHealth()` + `FRESHNESS_BUDGET` in `lib/integrations/status.ts`). No change needed.
- **Cron gap found**: there's no scheduled reputation scan. Only `/api/cron/review-requests` (which sends review-request emails). Reputation refresh requires clicking "Scan now" or adding a cron entry to `vercel.json`.
- **Audit script**: `scripts/audit-sg-integrations.ts` (read-only) prints SG's GA4/GSC/AppFolio/reputation/AEO/neighborhoods state.
- **Launch checklist**: `docs/SG_LAUNCH_CHECKLIST.md` — exact manual steps for Adam.

### 5. SG provisioning
- **Script**: `scripts/provision-sg-real-estate.ts` — locates SG, prints identity + integration state, diffs module flags vs target, flags demo seed contamination, emits TODOs. Dry-run by default; `--apply` to persist.

## 🚨 Open decisions — Adam, please confirm

### A. The slug confusion
SG's org row has `name = "SG Real Estate"` but `slug = "telegraph-commons"` and primary domain `telegraphcommons.com`. Possibilities:
1. **"Telegraph Commons" is SG's marketing brand name** — they brand the platform/marketing site as Telegraph Commons (which is also one of their flagship properties). Keep the slug, just stop calling it "demo" anywhere.
2. **The slug needs to be renamed to `sg-real-estate`** — and Telegraph Commons becomes a separate seeded demo org. This requires subdomain reroute + updating embed snippets.

Pick one before Friday. Affects: embed snippets, subdomain routing, anywhere "Telegraph Commons" appears as a label in the UI.

### B. The lone "Telegraph Commons" property
SG has one property literally named `"Telegraph Commons"` (lifecycle=ACTIVE). Provisioning script flagged it but did NOT delete it. If this is a real SG property (likely), keep it. If it's demo seed contamination, delete it.

### C. Run `provision-sg-real-estate.ts --apply`?
Will flip these module flags on SG:
- ON: `moduleEmail`, `moduleOutboundEmail`, `moduleReferrals`, `modulePopups`, `moduleVault` (plus the new modules from migration once applied: `moduleReputation`, `moduleInsights`, `moduleAttribution`, `moduleResidents`, `moduleTours`, `moduleConversations`)
- OFF: `moduleGoogleAds`, `moduleMetaAds` (SG has no ad accounts)
- Already-correct flags untouched

Run order: apply migration first → run provisioning script with `--apply`.

## Adam's pre-launch action list

1. Decide A + B above.
2. Apply migration: `pnpm prisma migrate deploy` (production-safe additive migration).
3. Run `pnpm exec tsx scripts/audit-sg-integrations.ts` to baseline integration health.
4. Run `pnpm exec tsx scripts/provision-sg-real-estate.ts --apply` (after deciding on the slug + property).
5. Connect/verify in `/portal/seo`:
   - GA4 service-account grant
   - GSC service-account grant
6. Set `googlePlaceId` per SG property — currently no UI, must be done via SQL (flagged as missing UI to build later).
7. Verify Vercel env: `ANTHROPIC_API_KEY` (required), `OPENAI_API_KEY` / `PERPLEXITY_API_KEY` / `GOOGLE_GEMINI_API_KEY` (for full AEO), `TAVILY_API_KEY` + `GOOGLE_PLACES_API_KEY` (for reputation).
8. Publish at least one `NeighborhoodPage` per SG market.
9. Replace popup embed on SG's marketing site (see `docs/SG_REAL_ESTATE_EMBED_INSTALL.md`).
10. Click "Scan now" on `/portal/seo/aeo` and `/portal/reputation` so SG has live data on launch day (don't wait for the Monday cron).
11. Upload SG logo at `/portal/settings/branding`.
12. Set `subscriptionStatus` on SG's org row.
13. Consider adding a reputation-scan cron entry to `vercel.json`.

## Verification

- `pnpm tsc --noEmit` → **0 errors**
- 23 files modified, 6 new
- Migration not yet applied
- No production DB writes from this session

## Files reference

**New:**
- `lib/portal/module-gate.tsx`
- `prisma/migrations/20260520_module_parity/migration.sql`
- `scripts/audit-sg-integrations.ts`
- `scripts/provision-sg-real-estate.ts`
- `docs/SG_LAUNCH_CHECKLIST.md`
- `docs/SG_REAL_ESTATE_EMBED_INSTALL.md`
- `docs/SG_HARDENING_PASS_2026-05-19.md` (this file)

**Touched:**
- `prisma/schema.prisma`
- `lib/actions/admin-modules.ts`
- `app/admin/clients/[id]/page.tsx`, `module-toggle.tsx`
- `app/portal/layout.tsx`, `components/portal/portal-nav.tsx`
- `app/portal/{applications,attribution,briefing,conversations,insights,popups,renewals,reports,reputation,residents,tours,work-orders}/page.tsx` (gated)
- `app/api/portal/reputation/scan/route.ts`, `app/api/portal/seo/aeo/scan/route.ts`
- `app/api/public/chatbot/chat/route.ts` (POST_CHAT bell notification bug)
- `app/portal/seo/aeo/page.tsx`
- `components/portal/reputation/reputation-scan-button.tsx`
