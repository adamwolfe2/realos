# SG Real Estate — Friday Launch Checklist

SG has NO Google Ads, NO Meta Ads. Their entire post-launch data story is:

| Surface       | Provides                                  | Required cadence       |
| ------------- | ----------------------------------------- | ---------------------- |
| GA4           | organic sessions / users / landing pages  | every 30 min (cron)    |
| GSC           | search clicks / impressions / queries     | every 30 min (cron)    |
| Reputation    | Google + Yelp + Reddit mentions/sentiment | on-demand (no cron!)   |
| AEO           | ChatGPT/Perplexity/Claude/Gemini visibility | weekly Monday 02:00 UTC |
| Neighborhoods | landing pages + AI citation health        | weekly inside AEO cron  |

Before running any of the steps below, run the read-only audit and use its output as your source of truth:

```bash
set -a; source .env.local; set +a
pnpm exec tsx scripts/audit-sg-integrations.ts
```

---

## 1. GA4 — required

The audit script will print whether SG has a `SeoIntegration` row with `provider=GA4`. If it shows `no GA4 integration rows for SG`:

1. Log in to GA4 as someone who owns the SG property: <https://analytics.google.com>.
2. In the top-left **property picker**, select the SG property. **Critical:** the selected property must match the numeric Property ID you're about to paste in the portal.
3. Click the **gear icon (Admin)** in the bottom-left.
4. In the **right column (Property)** click **Property access management**. Do NOT use the Account column.
5. Click the **blue +** in the top-right → **Add users**.
6. Paste: `leasestack-integrations@leasestack.iam.gserviceaccount.com`
7. Untick "Notify new users by email".
8. Set role to **Viewer**. Click **Add**.
9. Open <https://app.leasestack.co/portal/seo> while signed in as SG's owner.
10. Find the **GA4** card → **Connect**. Pick the LeaseStack property if it's a multi-property tenant; paste the GA4 numeric Property ID (Admin → Property Settings → Property ID); click **Save**.
11. The cron at `/api/cron/seo-sync` (every 30 min in `vercel.json`) will backfill 30 days on first run, then keep a rolling 2-day window fresh.

Verify by re-running the audit script. You want:

- `GA4 ... status=IDLE last=<recent>`
- ≥1 `SeoSnapshot` row in the last 7d

## 2. GSC — required

If audit shows `no GSC integration rows for SG`:

1. Open Search Console as someone who owns the SG property: <https://search.google.com/search-console>.
2. In the left sidebar pick the property whose URL matches the site you're connecting.
3. Scroll to the bottom of the left sidebar → click **Settings** (gear).
4. Click **Users and permissions** → **Add user** (top-right).
5. Paste: `leasestack-integrations@leasestack.iam.gserviceaccount.com`
6. Permission: **Restricted** (read-only) is sufficient. Click **Add**.
7. Open <https://app.leasestack.co/portal/seo> → **GSC** card → **Connect**.
8. Pick the LeaseStack property. Paste the GSC property identifier. Two forms accepted:
   - Domain property: `sc-domain:sgrealestate.com`
   - URL prefix property: `https://www.sgrealestate.com/`
9. Click **Save**. Backfill runs immediately.

Verify by re-running the audit:

- `GSC ... status=IDLE last=<recent>`
- ≥1 row of clicks/impressions in last 7d

GSC publishes with a 1–2 day lag — don't expect today's data on launch day.

## 3. Reputation sources — recommended

There is **no UI** to configure `googlePlaceId` / `yelpBusinessId` / `redditSubreddits` per property. They're seeded by AppFolio import or set directly. Two paths:

### 3a. Most properties have a Google Business Profile

For each SG property that has a Google Maps page:

1. Find its Place ID: <https://developers.google.com/maps/documentation/places/web-service/place-id> — search the property name, copy the `ChIJ...` Place ID and the canonical Maps URL.
2. Run a one-off SQL update (no UI yet) for each property, e.g.:
   ```sql
   UPDATE "Property"
   SET "googlePlaceId" = 'ChIJ...',
       "googleReviewUrl" = 'https://www.google.com/maps/place/...'
   WHERE "orgId" = '<sg-org-id>' AND "name" = '<property-name>';
   ```
3. Open `/portal/reputation` as the SG owner and click **Scan now**. Rate-limited 1/hour/org.

### 3b. No cron exists — flag

There is currently no cron job that runs reputation scans. The `/api/cron/aeo-scan` weekly job does NOT scan reputation. Operators (Adam) must trigger scans manually via **Scan now** on the dashboard. If SG wants weekly fresh mentions, add a cron entry — out of scope for this checklist.

### 3c. Reputation API keys

The audit prints which engine keys are present. For reputation scans, confirm in Vercel project env:

- `TAVILY_API_KEY` — web mentions (required, ~$0.008/query × 4 queries/scan)
- `GOOGLE_PLACES_API_KEY` — Google reviews
- Reddit: no key required (public JSON endpoints)
- Yelp: `YELP_API_KEY` — only used when the property has `yelpBusinessId`

If any of these are missing in prod, the scan still runs but the failing source will surface in the **Scan now** button feedback (fixed in this session).

## 4. AEO — required

The cron is wired (`/api/cron/aeo-scan`, every Monday 02:00 UTC). The audit prints which engines have API keys.

**Minimum acceptable:** `ANTHROPIC_API_KEY` set (Claude works). The portal will now show "Not configured — API key missing on server" on the per-engine cards for engines without keys (fixed in this session), and the on-demand **Scan now** endpoint returns 503 with a clear error when zero engines are configured.

For maximum coverage in Vercel env:

- `ANTHROPIC_API_KEY` — Claude
- `OPENAI_API_KEY` — ChatGPT
- `PERPLEXITY_API_KEY` — Perplexity
- `GOOGLE_GEMINI_API_KEY` (or `GEMINI_API_KEY`) — Gemini

The first weekly cron tick after launch will populate `AeoCitationCheck` rows for all of SG's marketable properties. To verify before Monday:

1. Open `/portal/seo/aeo` as SG owner.
2. Click **Scan now** (rate-limited 1 per 12h).
3. Confirm rows land — re-run the audit script and check the `AEO` section.

## 5. Neighborhood pages — recommended

Open `/portal/seo/neighborhoods` as SG owner and publish at least one page (or several) per market they serve. Published pages get sampled by the weekly cron with light scans (2 claims × 2 prompts × N engines), so publishing them before Monday gets them in the next AI citation report.

---

## Cron schedule audit

From `vercel.json`:

| Cron path                  | Schedule       | Status                                                       |
| -------------------------- | -------------- | ------------------------------------------------------------ |
| `/api/cron/seo-sync`       | `*/30 * * * *` | OK — GA4 + GSC fan-out for every org with SeoIntegration row |
| `/api/cron/aeo-scan`       | `0 2 * * 1`    | OK — weekly Monday 02:00 UTC (incl. neighborhood pages)      |
| `/api/cron/review-requests`| `0 15 * * *`   | OK — daily, emails signed leads (Google review nudge)        |
| **(missing)** reputation   | —              | **FLAG** — no scheduled reputation scan; relies on **Scan now** |

## Bugs fixed this session

1. **AEO per-engine cards** — now show "Not configured — API key missing on server" instead of "No queries yet" when the server lacks an API key for that engine. (`app/portal/seo/aeo/page.tsx`)
2. **AEO on-demand scan** — returns 503 with explicit error when zero engines are configured. Pre-fix the scan returned `rowsWritten=0` and looked like a successful run. (`app/api/portal/seo/aeo/scan/route.ts`)
3. **Reputation Scan now button** — surfaces per-source failures (e.g. Tavily rate limit, Yelp 429) in the button feedback instead of swallowing them inside the response payload. (`app/api/portal/reputation/scan/route.ts` + `components/portal/reputation/reputation-scan-button.tsx`)

## Manual steps Adam must do before Friday

1. Run `pnpm exec tsx scripts/audit-sg-integrations.ts` and paste the output into the launch ticket.
2. Connect GA4 (Step 1 above) if audit shows missing.
3. Connect GSC (Step 2 above) if audit shows missing.
4. Set `googlePlaceId` / `googleReviewUrl` on each SG property via SQL (Step 3a). Then click **Scan now** on `/portal/reputation`.
5. Confirm Vercel env has `ANTHROPIC_API_KEY` at minimum (Step 4). Add `OPENAI_API_KEY` + `PERPLEXITY_API_KEY` + `GOOGLE_GEMINI_API_KEY` for full AEO coverage.
6. Publish at least one neighborhood page in `/portal/seo/neighborhoods`.
7. Click **Scan now** on `/portal/seo/aeo` once everything is connected so SG has live AEO data on launch day rather than waiting for Monday 02:00 UTC.
8. Decide whether to add a reputation-scan cron entry — out of scope here but track it. Without it, reputation only refreshes when an operator clicks **Scan now**.
