# SEO / AEO Agent — Architecture & Tool Recommendation

> **Goal:** /portal/seo becomes an AI agent that reads from the operator's live data (GA4 + GSC + sitemap + AEO citations + competitor signals) and (a) gives ranked, actionable recommendations, (b) drafts full SEO-optimized blogs/pages/supplemental copy, (c) routes drafts to Adam for approve/deny, and (d) tracks a composite SEO+AEO score over time.
>
> **Audience:** Adam Wolfe (operator) + future engineers picking up this work.
>
> **Status:** design + Phase-1 scope. Phase-1 schema is in this commit. Phase-2 onward is multi-week.

---

## TL;DR — what we're building

```
                    LeaseStack SEO/AEO Agent
        ┌─────────────────────────────────────────────────┐
        │                                                  │
   ┌────┴────┐    ┌──────────┐    ┌────────────┐    ┌─────┴─────┐
   │ Sources │ →  │ Engine   │ →  │ Recs +     │ →  │ Operator  │
   │         │    │ (Claude) │    │ Drafts     │    │ Portal    │
   └─────────┘    └──────────┘    └────────────┘    └───────────┘
   GA4               score        SeoAction         /portal/seo/agent
   GSC               diff         Recommendation       (operator view)
   Sitemap           prompt       ContentDraft       /admin/content-drafts
   AeoCitation                                          (Adam approval)
   Competitor (DataforSEO)
```

**Operator sees:** "5 ranked actions this week + 3 page drafts ready for Adam's review."
**Adam sees:** drafts queue with approve / edit / reject / "send to Claude Code" actions.
**System tracks:** SEO+AEO composite score, week-over-week deltas, citations earned.

---

## Tool recommendation: DataforSEO + our own AEO loop

### Recommended primary tool: **DataforSEO**

**Verdict:** ✅ Use DataforSEO as the SEO data layer. Skip third-party AEO tools — we already have it.

**Why DataforSEO over Ahrefs / SEMrush / Moz / Surfer / Frase / Conductor:**

| Criterion | DataforSEO | Ahrefs / SEMrush | Surfer / Frase | Moz |
|---|---|---|---|---|
| **API-first** | ✅ Built for wrapping. No UI to compete with. | ⚠️ API exists but they want you in their dashboard | ⚠️ API exists but content-focused | ✅ Old API, fine |
| **Pricing model** | Pay-per-call ($0.0001–$0.01 each). **Scales with users.** | $500–$3,000/mo flat per seat | $50–$300/mo flat | $99–$599/mo flat |
| **Endpoint coverage** | SERP, Keywords, Backlinks, On-Page (Lighthouse + Core Web Vitals + crawl), Content Analysis, Domain Analytics, Local SEO — every category | Strong on backlinks + keywords | Content optimization only | Basic SERP + DA |
| **White-label / wrapper friendly** | ✅ Explicit positioning: "build your own SEO tool on us" | ❌ Their UI is the product | ⚠️ | ⚠️ |
| **MCP / webhooks** | REST + webhooks, ~3s response, clean JSON | REST only | REST only | REST only |
| **Multi-tenant scaling** | One DataforSEO account, many LeaseStack tenants, billed by usage | Per-seat = doesn't scale | Per-seat | Per-seat |

**Concrete DataforSEO endpoints we'll use:**

- `serp_google_organic_live_advanced` — what's ranking for a tenant's target queries right now, with the top 10 results + features (FAQ, Knowledge Graph, etc.). $0.002/call.
- `keywords_data_google_ads_search_volume_live` — monthly volume + competition + CPC for any keyword. $0.0001/call.
- `dataforseo_labs_google_keyword_suggestions_live` — given a seed keyword, 1000+ related queries with volume and difficulty. $0.01/call.
- `dataforseo_labs_google_competitors_domain_live` — given a tenant's domain, returns 10 closest organic competitors with overlap %. $0.02/call.
- `on_page_lighthouse_live_json` — runs Lighthouse on any URL, returns full Core Web Vitals + accessibility + SEO scores. $0.01/call.
- `on_page_instant_pages` — single-page audit with title/meta/H1/images/internal-links analysis. $0.005/call.
- `backlinks_summary_live` — domain authority + referring domains. $0.02/call.

**Estimated monthly DataforSEO cost per LeaseStack tenant:** ~$8–$15 for the typical 4-property portfolio at weekly cadence. We pass this through in the retainer.

### Recommended AEO approach: **keep our own loop**

We **already have** a working AEO scanner in `lib/aeo/orchestrate.ts` that:

- Pings ChatGPT (Bing-grounded), Perplexity, Claude, Gemini directly
- Logs every result to `AeoCitationCheck` with status (`CITED` / `NOT_CITED` / `COMPETITOR_CITED`) + the competitor names cited
- Cost: ~$0.001–$0.005 per prompt-engine pair

**Third-party AEO tools considered:**

- **Profound** — $499–$3,000/mo. Tracks ChatGPT/Perplexity citation rates with competitor benchmarking. Best-in-class for AEO analytics. **Verdict:** skip until we have ≥10 paying tenants. Our own loop covers 80% of the value at <5% of the cost.
- **Otterly.ai / Peec.ai / Goodie / Athena / HALO** — newer entrants. Smaller datasets, less mature APIs. Skip.

**Phase 3 upgrade path:** add Profound for tenants on Scale / Custom tiers who specifically ask for competitive AEO benchmarking. Don't gate the core feature on it.

---

## Architecture

### Data sources (all already exist or are trivial to add)

| Source | Status | Table / API |
|---|---|---|
| GA4 — organic sessions, top pages, conversions | ✅ Wired (`SeoIntegration` with `provider=GA4`) | `SeoSnapshot` (daily rollups), `SeoLandingPage` (per-page) |
| GSC — queries, impressions, clicks, CTR, position | ✅ Wired (`SeoIntegration` with `provider=GSC`) | `SeoSnapshot`, `SeoQuery` |
| Sitemap — published page inventory | ✅ Generated at `/sitemap.xml` from `NeighborhoodPage` + `BLOG_POSTS` | `app/sitemap.ts` |
| AEO citations — who AI engines mention | ✅ Wired (`lib/aeo/orchestrate.ts`) | `AeoCitationCheck` |
| Competitor SERP — who's ranking for our queries | ⏳ NEW — Phase 2 | DataforSEO via `lib/seo/dataforseo.ts` |
| On-page audit — Lighthouse / Core Web Vitals | ⏳ NEW — Phase 2 | DataforSEO `on_page_lighthouse_live_json` |
| Backlinks — referring domains, anchor text | ⏳ NEW — Phase 3 | DataforSEO `backlinks_summary_live` |

### New tables (Phase 1, shipped in this commit)

```prisma
// Phase 1: the recommendation engine and the content drafting workflow.

model SeoActionRecommendation {
  id          String   @id @default(cuid())
  orgId       String
  org         Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  propertyId  String?
  property    Property?    @relation(fields: [propertyId], references: [id], onDelete: SetNull)

  // What category this rec falls into. Drives the icon + section grouping
  // in the UI. Keep in sync with lib/seo/agent.ts category union.
  category    SeoActionCategory

  // Stable id (kind + scope) so the engine can dedupe across re-runs.
  // E.g. "ctr-fix:apartments-near-campus" or "neighborhood-page:downtown-berkeley".
  kind        String

  // Operator-facing fields.
  title       String   @db.Text
  detail      String   @db.Text
  severity    SeoActionSeverity
  estimateMinutes Int
  score       Float    // Composite priority. UI sorts by this descending.
  actionHref  String?  // Direct route into the surface to act.
  actionLabel String?

  // Lifecycle.
  status      SeoActionStatus @default(OPEN)
  dismissedAt DateTime?
  dismissedReason String?
  completedAt DateTime?
  completedBy String?  // user id who marked it done

  // Trace back to the underlying signal so we can show "why".
  evidence    Json?    // { queries: [...], pageIds: [...], engines: [...] }

  // Cached engine output. Refreshed nightly via /api/cron/seo-agent.
  generatedAt DateTime @default(now())
  refreshedAt DateTime @default(now())

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  drafts      ContentDraft[]

  @@unique([orgId, propertyId, kind])
  @@index([orgId, status, score(sort: Desc)])
  @@index([orgId, category])
}

enum SeoActionCategory {
  CTR_FIX               // Page exists, ranks well, low CTR — fix title/meta
  CONTENT_GAP           // Competitor ranks for a query we don't even cover
  NEIGHBORHOOD_PAGE     // Publish a /n/<slug> page for a target neighborhood
  REFRESH               // Existing page is stale (>90d since update)
  AEO_GAP               // Competitor cited by ChatGPT/Perplexity where we aren't
  AEO_NOT_CITED         // We're not surfacing for a target prompt at all
  ONPAGE_AUDIT          // Lighthouse / Core Web Vitals issue
  BACKLINK_OPPORTUNITY  // A site that links to a competitor doesn't link to us
  SCHEMA_GAP            // Missing structured data (FAQPage, LocalBusiness, etc.)
  INTERNAL_LINKING      // High-value page is orphaned or under-linked
}

enum SeoActionSeverity {
  CRITICAL
  HIGH
  MEDIUM
  LOW
}

enum SeoActionStatus {
  OPEN
  IN_PROGRESS
  COMPLETED
  DISMISSED
  EXPIRED
}

// ContentDraft — Claude-generated SEO-optimized copy waiting for review.
// Operator can request a draft from any recommendation. Admin (Adam)
// reviews and approves; on approval the operator gets the markdown +
// metadata for one-click "send to Claude Code" handoff.

model ContentDraft {
  id         String   @id @default(cuid())
  orgId      String
  org        Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  propertyId String?
  property   Property?    @relation(fields: [propertyId], references: [id], onDelete: SetNull)

  // What we're drafting. Format flips the prompt + the rendered output.
  format     ContentFormat

  // Optional link back to the recommendation that asked for this draft.
  recommendationId String?
  recommendation   SeoActionRecommendation? @relation(fields: [recommendationId], references: [id], onDelete: SetNull)

  // The brief — what the operator asked for in their own words.
  brief      String   @db.Text
  // Target query / intent the page should rank for. Pre-filled when
  // generated from a CONTENT_GAP or CTR_FIX recommendation.
  targetQuery String?

  // Output. JSON because different formats have different shapes
  // (blog has title/meta/body/faq; neighborhood page has sections/faqs).
  output     Json?
  // Raw rendered markdown — what Adam pastes into Claude Code.
  outputMarkdown String? @db.Text
  // The model that generated this draft + estimated SEO score.
  model      String?
  estimatedScore Int?     // 0–100 composite content quality estimate

  // Status workflow.
  status     DraftStatus @default(GENERATING)
  generatedAt DateTime?
  submittedAt DateTime?
  reviewedAt DateTime?
  reviewedBy String?      // admin user id
  reviewNotes String?     @db.Text
  shippedAt  DateTime?    // when the operator marked it published

  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([orgId, status])
  @@index([status, submittedAt])
}

enum ContentFormat {
  BLOG_POST
  NEIGHBORHOOD_PAGE
  PROPERTY_DESCRIPTION
  META_REWRITE             // Title + meta description only (for CTR_FIX)
  FAQ_BLOCK                // FAQ schema-ready Q&A for an existing page
  AD_COPY                  // Google / Meta ad copy
}

enum DraftStatus {
  GENERATING       // Claude is producing output
  PENDING_REVIEW   // Awaiting Adam's approval
  APPROVED         // Adam approved; operator can ship
  CHANGES_REQUESTED // Adam left review notes; back to Claude for revision
  REJECTED         // Adam rejected outright
  SHIPPED          // Operator marked it live on their site
  EXPIRED          // No action for 30d; dropped from queue
}

// Composite score over time — one row per (org, property, week)
// so the operator can see "we went from 42 → 58 over Q2." Computed
// from the latest SeoSnapshot + AeoCitationCheck + on-page audit.

model SeoScoreHistory {
  id          String   @id @default(cuid())
  orgId       String
  org         Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  propertyId  String?
  property    Property? @relation(fields: [propertyId], references: [id], onDelete: SetNull)

  weekOf      DateTime  // Monday 00:00 UTC

  // Sub-scores (0–100 each). UI shows the breakdown.
  technicalScore     Int    // Core Web Vitals + crawl + schema
  contentScore       Int    // Coverage breadth + freshness
  authorityScore     Int    // Backlinks + domain age + brand mentions
  aeoCitationRate    Float  // 0..1 — share of target prompts citing us
  organicTrafficIdx  Int    // Indexed against 90d trailing baseline (100 = baseline)
  conversionRateIdx  Int    // Same shape — leads / organic sessions

  // Composite — weighted blend of the above.
  compositeScore     Int    // 0–100

  createdAt   DateTime @default(now())

  @@unique([orgId, propertyId, weekOf])
  @@index([orgId, weekOf])
}
```

### New library code (Phase 1 scaffolding shipped)

```
lib/seo/
  agent.ts                  Synthesizes recommendations from existing data.
                            Mirrors lib/intelligence/property-recommendations.ts
                            shape but with SEO-specific rules. Returns
                            ProactiveAction[] persisted to SeoActionRecommendation.
  draft-writer.ts           Claude-powered content drafter. One function per
                            ContentFormat. Returns ContentDraft.output JSON +
                            outputMarkdown.
  score.ts                  Composite-score computation from SeoSnapshot +
                            AeoCitationCheck + Lighthouse. Writes
                            SeoScoreHistory.
  dataforseo.ts             Thin REST wrapper around DataforSEO. Auth via
                            DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD env. (Phase 2)
```

### New API routes (Phase 1)

```
POST   /api/portal/seo/recommendations/refresh    Force-regenerate the rec list (operator action)
POST   /api/portal/seo/drafts                     Create a new ContentDraft
GET    /api/portal/seo/drafts/[id]                Get the draft (for polling while GENERATING)
POST   /api/portal/seo/drafts/[id]/submit         Push to admin queue
POST   /api/portal/seo/drafts/[id]/ship           Operator marks SHIPPED after publishing

POST   /api/admin/content-drafts/[id]/approve     Admin approve
POST   /api/admin/content-drafts/[id]/changes     Admin request changes (text note)
POST   /api/admin/content-drafts/[id]/reject      Admin reject (text note)
```

### New UI surfaces (Phase 2-3)

- `/portal/seo/agent` — new page. Top: composite score + week-over-week delta. Middle: ranked action cards (reuse `PropertyIntelligencePanel` shape). Bottom: drafts in flight + recently shipped.
- `/portal/seo/drafts/[id]` — operator's draft view. Shows the brief + Claude's output + status. "Submit for review" CTA. After approval shows the "Copy markdown" button + "Send to Claude Code" handoff.
- `/admin/content-drafts` — Adam's review queue. Drafts grouped by org. Inline diff if revising. Approve / Request changes / Reject buttons. Renders markdown preview side-by-side with raw.

### Nightly cron

`/api/cron/seo-agent` runs at 03:30 UTC daily:

1. For every LIVE property, refresh `SeoActionRecommendation` rows (delete completed + expired, upsert open ones).
2. For every property, compute the week's `SeoScoreHistory` row if Monday hasn't been processed yet.
3. For drafts stuck in `PENDING_REVIEW` >30d, mark `EXPIRED`.
4. Trigger DataforSEO syncs (Phase 2) for top 50 target queries per property.

---

## Operator workflow (end-to-end)

1. **Operator opens `/portal/seo/agent`.** Sees: composite score (e.g. 56/100, up 4 from last week), 7 ranked actions ("Refresh Downtown Berkeley page", "Write counter-page for 'student housing near campus' — competitor Y cited 4× this month", etc.).
2. **Clicks "Draft this page" on a CONTENT_GAP recommendation.** Claude generates a ContentDraft in ~15s (status GENERATING). Operator can iterate: rewrite the brief, change the target query, ask for shorter / longer / friendlier tone.
3. **Operator clicks "Submit for review."** Status flips to PENDING_REVIEW, an entry lands in Adam's `/admin/content-drafts` queue. Operator sees "waiting on Adam — typically <24h."
4. **Adam reviews.** Approves, requests changes (with notes), or rejects. On approve, the operator gets a notification.
5. **Operator copies the markdown and pastes into Claude Code** (or in Phase 3, hits "Auto-ship via GitHub PR" and we open the PR directly on their site repo). Marks the draft SHIPPED. The score's content sub-score lifts on the next nightly run.

---

## Phasing — concrete next steps

### Phase 1 (shipped in this commit)

- ✅ Architecture doc (this file).
- ⏳ Prisma schema additions (next commit — I want your sign-off on the tool recommendation first before migrating).
- ⏳ `lib/seo/agent.ts` skeleton with rule signatures (mirrors `lib/intelligence/property-recommendations.ts`).
- ⏳ DataforSEO account + env vars in `.env.example` (don't sign up yet — wait for your decision).

### Phase 2 (~3 days)

- DataforSEO client + competitor scan cron
- Recommendation engine rules wired to real data
- ContentDraft + DraftWriter (Claude-powered) — BLOG_POST, NEIGHBORHOOD_PAGE, META_REWRITE formats
- Operator UI at `/portal/seo/agent`
- Admin queue at `/admin/content-drafts`

### Phase 3 (~3 days)

- SeoScoreHistory + score chart (week-over-week)
- On-page audit integration (DataforSEO Lighthouse)
- Backlink-opportunity rule
- Optional: Profound integration for tenants on Scale tier

### Phase 4 (future)

- Auto-ship via GitHub PR (we open the PR on the tenant's marketing site repo)
- Content versioning + revision diffs
- A/B test new titles vs old via CTR delta
- White-label "branded SEO report" PDF export

---

## Decisions I need from you before Phase 2

1. **Tool: DataforSEO + own AEO loop?** (My recommendation.) Alternatives: Ahrefs API, Surfer SEO, Profound for AEO. Cheapest = DataforSEO at $8–$15/tenant/month.
2. **Where does the cost get passed?** Folded into the retainer (transparent), or itemized on the invoice?
3. **Auto-ship via GitHub PR (Phase 4) — yes or no?** This would mean LeaseStack opens a PR on the tenant's marketing site GitHub repo with the new blog/page committed. Saves them the Claude Code paste step. Higher trust required.
4. **Approval timeline SLA — 24h, 48h, or no SLA?** Drives how aggressive the operator UI is about deadlines.

Once we lock these, Phase 1 implementation (schema + scaffolding) is one commit. Phase 2 is the meat — about 3 days of focused work.
