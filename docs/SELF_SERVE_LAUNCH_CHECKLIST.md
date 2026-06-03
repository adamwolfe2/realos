# Self-Serve Launch Checklist

Single source of truth for every environment variable, third-party
approval, and platform configuration step that must be in place before
opening the front door to operator sign-ups.

The platform code already compiles, runs, and ships value when most of
these are missing — `ConnectHub` renders a "Coming soon" disabled state
for any source the agency hasn't provisioned yet, so an operator who
signs up before everything is ready still gets a clean experience. But
features marked **REQUIRED** below are the minimum to deliver the
"AppFolio + GA4 + GSC connected → weekly report" happy path that the
demo and sales pitch promise.

Update this doc as items land. Cross-reference [docs/ENV_VARS.md](./ENV_VARS.md)
for the full per-variable reference; this doc is the prioritized launch
roadmap.

---

## Status legend

- ✅ **Done** — set in Vercel prod env, verified working
- 🟡 **In progress** — partially complete, blocked on external approval
- ⬜ **Open** — not yet started

---

## 1. Auth + database (core, REQUIRED)

| Item | Env vars | Status | Notes |
|------|----------|--------|-------|
| Clerk auth | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET` | ✅ | Webhook events: `user.created`, `user.updated`, `user.deleted`, `organization.created/updated`, `organizationMembership.created` |
| Neon Postgres | `DATABASE_URL`, `DIRECT_DATABASE_URL` | ✅ | Pooler URL for app, direct for migrations |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | ✅ | |
| Resend | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | ✅ | Confirm sender domain DKIM/DMARC in Resend dashboard |
| Upstash KV (rate limit) | `KV_REST_API_URL`, `KV_REST_API_TOKEN` | ✅ | In-memory fallback exists for dev |
| Encryption | `ENCRYPTION_KEY` (32-byte hex) | ⬜ | `openssl rand -hex 32`. Required to encrypt per-tenant AppFolio creds + ad-account tokens at rest. **Operators cannot save AppFolio creds without this.** |
| Cron auth | `CRON_SECRET` | ✅ | |
| Bootstrap | `BOOTSTRAP_SECRET` | ✅ | One-time admin provisioning |

---

## 2. Operator-facing OAuth providers (REQUIRED for self-serve)

These gate the `/portal/connect` cards. Without them, operators see
"Coming soon" instead of working OAuth flows.

### 2a. Google OAuth (powers GA4, GSC, Google Ads)

| Item | Env var | Status | Notes |
|------|---------|--------|-------|
| Master gate | `OAUTH_ENABLED=true` | ⬜ | Set last — flips OAuth on for the whole app |
| Callback base URL | `OAUTH_CALLBACK_BASE_URL=https://www.leasestack.co` | ⬜ | No trailing slash. Must match Google Cloud Console redirect URIs |
| State HMAC secret | `OAUTH_STATE_SECRET` (32+ random hex) | ⬜ | `openssl rand -hex 32` |
| Google OAuth client | `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` | ⬜ | Created in [Google Cloud Console](https://console.cloud.google.com/apis/credentials). OAuth 2.0 Client ID, type "Web application". |
| Authorized redirect URIs to register in GCP | n/a | ⬜ | `https://www.leasestack.co/api/oauth/ga4/callback`, `.../gsc/callback`, `.../google-ads/callback` |
| Required OAuth scopes (granted at consent) | n/a | ⬜ | `analytics.readonly`, `webmasters.readonly`, `adwords` |
| OAuth consent screen | n/a | ⬜ | Submit for verification when going public. Until verified, only listed test users can connect. |

### 2b. Google Ads developer token (REQUIRED for Google Ads card)

| Item | Env var | Status | Notes |
|------|---------|--------|-------|
| Developer token (Test access) | `GOOGLE_ADS_DEVELOPER_TOKEN` | ✅ | Already set — test access. **Allows API calls only against your own account.** |
| Developer token (Standard access) | (same var, upgraded) | 🟡 | Apply at [Google Ads API Center](https://ads.google.com/aw/apicenter). **1–2 week review.** Required to call any operator's account. |
| Login customer ID (MCC) | `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | ✅ | The MCC used to access linked accounts |

### 2c. Meta OAuth (Facebook + Instagram Ads)

| Item | Env var | Status | Notes |
|------|---------|--------|-------|
| Meta app | `META_OAUTH_APP_ID`, `META_OAUTH_APP_SECRET` | ⬜ | Create in [Meta for Developers](https://developers.facebook.com/apps). App type: Business. |
| Required scopes | n/a | ⬜ | `ads_read`, `ads_management` |
| Authorized redirect URI to register | n/a | ⬜ | `https://www.leasestack.co/api/oauth/meta-ads/callback` |
| Business Verification | n/a | 🟡 | Required before Meta will grant cross-customer scopes |
| Marketing API Standard Access | n/a | 🟡 | Required to read other businesses' ad data. Submit App Review with explicit use-case copy. **Days to weeks of review.** |
| Meta Ad Library token (public-data widget) | `META_AD_LIBRARY_TOKEN` | ⬜ | One agency-level token serves every tenant. Generate from any Meta dev app with `ads_archive` scope. Without this, `/portal/properties/[id]/ads` shows a "configure" empty state. |

---

## 3. Cursive (visitor identification) pixel

| Item | Env var | Status | Notes |
|------|---------|--------|-------|
| the upstream pixel provider API | `CURSIVE_API_KEY` | ⬜ | TODO placeholder in `.env.example` |
| Webhook secret | `CURSIVE_WEBHOOK_SECRET` | ⬜ | Set when provisioning the the upstream pixel provider SuperPixel. Used as `x-audiencelab-secret` (shared-secret mode) or HMAC key (signature mode) |
| Pixel-request notify email | `PIXEL_REQUEST_NOTIFY_EMAIL` | ⬜ (defaults to `ADMIN_EMAIL`) | When an operator clicks "Request pixel" we email ops. the upstream pixel provider does not expose a programmatic provisioning API, so each request becomes a 3–5 min manual setup task. |

**Operator expectation set in UI:** the Connect Hub pixel card needs to
say "we'll set this up for you within X hours" so the manual ops step
doesn't feel like the platform is broken. _(See task #11.)_

---

## 4. Vercel programmatic domains (POLISH:CUSTOM_DOMAIN)

| Item | Env var | Status | Notes |
|------|---------|--------|-------|
| Vercel API | `VERCEL_API_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID` | ⬜ | Issue a fine-grained token with `domains:write` on the LeaseStack project. Blocks operator-side custom-domain attachment for tenant sites. |
| Vercel Blob (file uploads) | `BLOB_READ_WRITE_TOKEN` | ⬜ | Required for property hero images + creative assets |

---

## 5. Data sources (insights + reports)

| Item | Env var | Status | Notes |
|------|---------|--------|-------|
| Google Places API | `GOOGLE_PLACES_API_KEY` | ⬜ | Powers reputation scanner (Google Reviews) + nightly competitor scan. Free tier with project quota. Restrict key to Places API only. |
| Tavily web search | `TAVILY_API_KEY` | ⬜ | Reputation scanner web search (Reddit, Yelp, apartments.com, etc). Free tier: 1k searches/month. Each scan = 5 parallel queries → ~200 scans/mo free. |
| RentCast market intel | `RENTCAST_API_KEY` | ⬜ | Market AVM + comparables on property detail. Free tier: 50 calls/mo. First property render = 2 calls (AVM + market stats), cached 30d/14d. |
| Google service account | `GOOGLE_SERVICE_ACCOUNT_JSON` | ✅ | Platform-level — granted Viewer on each client's GA4 + GSC. Alternative path to OAuth (currently primary while OAuth is being set up). |
| DataforSEO | `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD` | ✅ | SEO data layer. Verified in prod. |

---

## 6. AI engines (chatbot + AEO + content drafter)

| Item | Env var | Status | Notes |
|------|---------|--------|-------|
| Anthropic Claude | `ANTHROPIC_API_KEY` | ✅ | Chatbot + suggest-reply + content drafter |
| OpenAI | `OPENAI_API_KEY` | ⬜ | AEO ChatGPT engine card. Without it that card shows "Not configured" but other AEO engines (Perplexity, Gemini) still render |
| Perplexity | `PERPLEXITY_API_KEY` | ⬜ | AEO Perplexity engine card |
| Gemini | `GEMINI_API_KEY` | ⬜ | AEO Gemini engine card |
| Firecrawl | `FIRECRAWL_API_KEY` | ⬜ | Site-intelligence ingestion (`/crawl`, `/scrape`, `/search`) |

---

## 7. Observability + ops

| Item | Env var | Status | Notes |
|------|---------|--------|-------|
| Sentry | `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `NEXT_PUBLIC_SENTRY_DSN` | ✅ | |
| PostHog | `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | ⬜ | Product analytics |
| GitHub bug-report | `GITHUB_TOKEN`, `GITHUB_BUG_REPORT_REPO` | ⬜ | Powers the in-app bug-report button. Fine-grained PAT with `repo` scope. |
| Slack webhook (optional) | `SLACK_WEBHOOK_URL` | ⬜ | Lead notifications, ops alerts |

---

## 8. Branding + app config

| Item | Env var | Status | Notes |
|------|---------|--------|-------|
| App URL | `NEXT_PUBLIC_APP_URL=https://leasestack.co` | ✅ | |
| Platform domain | `NEXT_PUBLIC_PLATFORM_DOMAIN=leasestack.co` | ✅ | |
| Brand | `BRAND_NAME`, `NEXT_PUBLIC_BRAND_NAME` | ✅ | |
| Admin contact | `ADMIN_EMAIL`, `OPS_NAME` | ✅ | |
| Cal.com booking | `NEXT_PUBLIC_CAL_NAMESPACE`, `NEXT_PUBLIC_CAL_LINK` | ✅ | Intake consultation link |
| GTM container | (hardcoded `GTM-TXX66PJJ`) | ✅ | Override with `NEXT_PUBLIC_GTM_ID` only for staging |
| Agency org seed | `AGENCY_ORG_SLUG`, `AGENCY_ADMIN_EMAIL` | ✅ | Singleton |

---

## Order of operations (recommended)

1. **Today / this week** — Set `ENCRYPTION_KEY`, `OAUTH_STATE_SECRET`,
   `BLOB_READ_WRITE_TOKEN`, `META_AD_LIBRARY_TOKEN`,
   `GOOGLE_PLACES_API_KEY`, `TAVILY_API_KEY`, `CURSIVE_API_KEY`,
   `CURSIVE_WEBHOOK_SECRET`. None of these require third-party approval.
2. **This week** — Create Google OAuth client, register redirect URIs.
   Set `GOOGLE_OAUTH_CLIENT_ID`/`SECRET`. Submit Google Ads developer
   token Standard Access application (long lead time — start it now).
3. **This week** — Create Meta app, submit Business Verification, submit
   Marketing API App Review. Set `META_OAUTH_APP_ID`/`SECRET`.
4. **Once OAuth credentials are verified** — Set `OAUTH_ENABLED=true`
   and `OAUTH_CALLBACK_BASE_URL`. The Connect Hub flips from "Coming
   soon" to live for the available providers automatically.
5. **Optional** — Wire up Perplexity / OpenAI / Gemini for AEO
   per-engine cards. RentCast for property-detail market intel. Firecrawl
   for site intelligence.

---

## How operators experience missing config

`/portal/connect` (and the embedded version on `/portal/setup`) reads
`getProviderAvailability()` from `lib/connect/provider-availability.ts`
on every load. The matrix:

| Provider | Source unavailable when | Card state |
|----------|------------------------|------------|
| AppFolio | _never_ (operator brings own credentials) | Always live |
| Cursive Pixel | _never_ (operator requests, ops provisions) | Always live |
| Your Website | _never_ (operator types URL) | Always live |
| GA4 | `OAUTH_ENABLED` false OR `GOOGLE_OAUTH_CLIENT_ID` missing | "Coming soon" disabled with reason |
| GSC | same as GA4 | "Coming soon" disabled with reason |
| Google Ads | GA4 conditions OR `GOOGLE_ADS_DEVELOPER_TOKEN` missing | "Coming soon" disabled with reason |
| Meta Ads | `OAUTH_ENABLED` false OR `META_OAUTH_APP_ID` missing OR `META_AD_LIBRARY_TOKEN` missing | "Coming soon" disabled with reason |

`/admin/clients` has a new **Setup** column showing per-tenant
onboarding phase + step counts so you can see at a glance who's stuck
in Foundation vs already shipping value.
