# SG Real Estate — Friday Launch Morning Brief

**Status: portal is launch-ready. 4 things left for Adam to do manually.**

---

## What got shipped overnight (4 commits)

### 1. SG module flags applied (`scripts/provision-sg-real-estate.ts --apply`)
- ON: Email, OutboundEmail, Referrals, Popups, Vault
- OFF: GoogleAds, MetaAds (no ad accounts connected)
- Net: 17/19 modules now in production state for SG

### 2. Telegraph popup template created (`scripts/apply-telegraph-popup.ts --apply --activate`)
- New PopupCampaign created with `limited-availability` template, ACTIVE
- Headline: "Now Leasing for 2026-2027" with auto year-accent on DARK theme
- Featured-value card, dual CTAs with icons, gradient accent
- **Install snippet to paste on telegraphcommons.com (replaces the old custom popup):**
  ```html
  <script async src="https://leasestack.co/embed/popup.js" data-tenant="telegraph-commons"></script>
  ```

### 3. Property detail page sparse-data polish (commit `feat(sg-launch)`)
- Properties with no activity (120 of SG's 127) now render a compact "Property in onboarding" card instead of a broken-overview shell
- HeroLeadsTile zero-state: dimmed em-dash + "First lead lands here" helper
- Lead funnel: when leads < 5, compact step-list with conversion % (replaces empty Recharts)
- Lead sources: single-source case renders "All 4 leads from Chatbot" horizontal bar (not a single-color donut)
- Renewal pipeline empty state is copy-only
- Ads sub-tab + hero rail Ad-performance card + module chips hidden when both ad modules are off
- Acquisition group now shows 2 pills (Leads + Traffic) instead of 3 with one permanently empty

### 4. Dashboard + Connect + Settings polish (same commit)
- Lead source donut falls back to horizontal bar when 1 slice or ≤5 total leads
- "X properties in onboarding" amber pill on dashboard links to `?launch=ONBOARDING` filter
- AppFolio auto-sync paused now surfaces as amber chip on dashboard + connect hub (was misleadingly green)
- Settings logo placeholder renders "SG" monogram on brand color instead of ghosted "Preview" text

### 5. Secondary surface cohesion sweep (commit `polish(portal)`)
- `/portal/leads`: source-mix one-liner + filter chips hide when zero data
- `/portal/popups`: honest KPIs for 1-popup tenants + "Create another" CTA
- `/portal/chatbot`: "Recent conversations" SectionCard
- `/portal/seo/neighborhoods`: centered empty state with helper copy
- `/portal/billing`: "Subscription status pending" callout for SG's null status
- `/portal/setup`: overall progress eyebrow + "X% · N of M"
- `/portal/notifications`: polished empty state
- Cohesion: all status pills rounded-md / 11px / lowercase, no emerald/amber rainbow, no emojis

---

## Current state of SG (verified live)

**Org**: SG Real Estate, slug `telegraph-commons`, domain `telegraphcommons.com`, tier SCALE
**Contact**: Norman Gensinger (ngensinger@triginvestmentgroup.com)

| Surface | Status |
|---------|--------|
| Chatbot config endpoint | ✅ 200 — Jessica persona, brand color, greeting all returning |
| Popup config endpoint | ✅ 200 — Limited Availability template active |
| GA4 sync | ✅ Last sync 2026-05-20 07:00 UTC |
| GSC sync | ✅ Last sync 2026-05-20 07:00 UTC |
| AppFolio | ⚠️ Connected but `autoSync=false` (surfaced in UI as amber chip) |
| Cursive pixel | ✅ Firing — last event 2026-05-19 22:05 UTC |
| Reputation | 3 properties have sources, 13 scans logged |
| Modules ON | Website, LeadCapture, Chatbot, SEO, Popups, Vault, Email, OutboundEmail, Referrals, CreativeStudio, Residents, Tours |
| Modules OFF | GoogleAds, MetaAds, Reputation, Insights, Attribution, Conversations |
| Leads | 4 total (3 chatbot, 1 form) |
| Properties | 127 (120 IMPORTED, 2 ACTIVE, 5 EXCLUDED) |
| Admins linked to Clerk | adamwolfe100@gmail.com + adam@meetcursive.com |

---

## 🔴 4 things Adam needs to do this morning

### 1. Upload SG's logo
**Where**: `/portal/settings/branding`
**Why**: currently a monogram "SG" placeholder. A real logo makes the portal feel finished.

### 2. Set `subscriptionStatus` on SG's org row
**Where**: `/admin/clients/<SG-id>` or via Prisma Studio
**Why**: billing page shows "Subscription status pending" until this is set. Should probably be `ACTIVE`.

### 3. Replace the popup script on telegraphcommons.com
**Action**: paste this snippet on the marketing site, remove the old custom popup markup:
```html
<script async src="https://leasestack.co/embed/popup.js" data-tenant="telegraph-commons"></script>
```
**Verify**: open telegraphcommons.com in an incognito window, wait 8 seconds → "Now Leasing for 2026-2027" popup appears.

### 4. Confirm the lone "Telegraph Commons" property
**ID**: `cmo402dzi0003c93lq9i6xz6h`
**Status**: lifecycle ACTIVE, this is SG's flagship building at 2490 Channing Way. The provisioning script flagged it because the name matched the demo seed pattern, but it should NOT be deleted — it's their real flagship. **No action needed unless you disagree.**

---

## 🟡 Nice-to-haves (not blockers)

- **Enable AppFolio autoSync** if you want hourly fresh property data. Currently paused (manually-synced model).
- **Add Google Place IDs to properties** for the Reputation module to work — there's still no UI for this (only direct SQL). Flag this as a future build.
- **Add OPENAI_API_KEY / PERPLEXITY_API_KEY / GOOGLE_GEMINI_API_KEY** to Vercel env if you want AEO citation tracking on all 4 engines. Claude already works.
- **`RENTCAST_API_KEY`** — already shipped the integration, but the Market Intelligence section is gated behind `moduleInsights` which is OFF for SG, so the key isn't strictly required for launch. Building Evaluator (`/portal/tools/value`) WILL need it when you want to demo on a sales call.

---

## Punch list (what's STILL not done)

These are all post-launch, not Friday blockers:

- Per-property Google Place ID editor UI
- AppFolio autoSync re-enable + cron monitoring
- White-label brand polish (SG's primary color is #000000 — pure black accents might feel heavy in places; consider a slightly softer accent)
- Email nurture flows (module is ON but no campaigns configured yet — operator self-serve)
- Referral program setup (module ON but no campaigns)
- Norman Gensinger access verification (admin user exists, hasn't logged in since 2026-03-XX — verify he can still get in)

---

## Where to start tomorrow

1. Run the 4 manual items above (~10 minutes)
2. Smoke-test the live portal: load `/portal` as SG → dashboard should be clean
3. Click into Telegraph Commons property → verify the new sparse-data treatment looks right
4. Click into a random IMPORTED property → verify the "Property in onboarding" compact card renders
5. Test the popup on Telegraph's marketing site once the new script tag is installed

If anything looks broken or off — tell me what you see and I'll fix it before the prospect call.

---

## Reference

- Full integration plan: `docs/RENTCAST_INTEGRATION_PLAN.md`
- Embed install guide: `docs/SG_REAL_ESTATE_EMBED_INSTALL.md`
- Original launch checklist: `docs/SG_LAUNCH_CHECKLIST.md`
- Hardening pass summary: `docs/SG_HARDENING_PASS_2026-05-19.md`

**Build hygiene tonight**: `pnpm tsc --noEmit` clean across all 4 commits. 28+ tests pass. No new dependencies introduced. No production DB writes other than the `--apply` script runs above (provisioning + popup).
