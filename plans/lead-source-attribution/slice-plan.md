# Lead source attribution (first-touch traffic source on every lead)

Brief: every lead and every chatbot conversation captured on a LeaseStack-embedded site
records WHERE the visitor came from (Zillow, Google, Instagram, ...), not just which capture
surface they used (chatbot/popup/form). Proven on Telegraph Commons, The Lair, The Den.

- Actor: anonymous site visitor (capture) · operator (reads it in portal + alert email).
- Invariant: a lead's first-touch source is written once and never overwritten by a later
  touch; it is always classified through `lib/attribution/source-taxonomy.ts` (one registry).
- Unsafe outcomes: client-supplied touch used for anything but display/reporting; oversized
  or malformed touch payload rejected the whole lead (must degrade to "no touch", never lose
  the lead); cross-tenant data; breaking existing embeds on sites with cached old scripts.
- Previous behaviour preserved: `Lead.source` (capture surface enum) unchanged; all routes
  accept payloads without `touch` (old cached embeds keep working).
- Assumptions: first-touch window 90 days in visitor localStorage per site domain; referrer
  recorded only when external host. No consent gate needed (first-party, functional, no PII).
- Out of scope: GA4 fusion, cost-per-lead, backfill of historic leads (only pageUrl utm).

Tier: 2 (additive schema + public ingest), no money/auth.

| # | Slice | Status |
|---|---|---|
| S1 | `lib/attribution/touch.ts`: zod touch schema + resolve (touch -> pageUrl fallback) + tests | done |
| S2 | Migration: Lead + ChatbotConversation `trafficSource` + `attribution` Json, index | done |
| S3 | Embeds: chatbot.js + popup.js capture first/last touch (`ls_touch`), send `touch` | done |
| S4 | Routes: chat, chatbot lead, popup lead, tours, public leads persist touch (create-only / fill-null) | done |
| S5 | Surfaces: lead alert email "Source", lead detail chip, attribution uses trafficSource | done |
| S6 | Verify live on TC/Lair/Den: tagged visit -> conversation row has source (no lead submit on SG) | pending |
