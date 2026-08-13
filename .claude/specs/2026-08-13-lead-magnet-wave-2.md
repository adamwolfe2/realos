# Lead Magnet Wave 2 — Report Redesign + Chatbot Builder + Reputation Front Door

Handoff spec from 2026-08-12/13 session (context-capped). Everything below
is scoped, verified feasible against existing code, and ready to build in
a fresh session. Say `go` on one slice at a time, in this order.

## Context: what already shipped (live on leasestack.co)

- `/ai-visibility` — AI-search audit lead magnet. Orbit hero, animated
  AiAnswerDemo (browser chrome + typed prompt + SoV bars), `ls-hl`
  animated highlight utility (globals.css), lead form that posts
  email+brandName into `/api/audit/start` BEFORE the scan. Report lands
  at `/audit/[token]#ai-search`, pre-unlocked.
- `/book-demo` — qualification wizard (contact → feature cards →
  inline Cal embed, Norman's `NEXT_PUBLIC_CAL_BOOK_URL`). Writes
  IntakeSubmission via `/api/onboarding` before booking. Every
  "Book a demo" CTA on the site routes here via `BookDemoLink` /
  `getBookDemoHref()`.
- Portal: AeoCustomPrompt (custom prompts per property, capped 10,
  API + UI on /portal/seo/aeo).
- Audit cost basis (measured, ApiUsage table, audit
  cmsquhche000004ld4fa1vva6): **~$0.12/audit logged** (Tavily $0.06,
  DataForSEO ai_llm 20 calls $0.057). All-in realistic $0.15-0.25.

## Slice 1 — Prospect report redesign (`/audit/[token]`)

Problem: report is a 12-section data dump. Sections have equal weight,
mention feed is 18 raw cards, "What this means" leaks markdown `#` and
reads LLM-generated. Nothing custom above the fold.

Shape (executive brief, not data dump):

1. **Verdict fold**: property name display-scale + their homepage
   screenshot (Firecrawl already renders it — check what the scan
   persists; else screenshot service) + score + ONE sentence verdict +
   "4 high-priority gaps" chip + book-a-call.
2. **Spine: "3 things costing you leases"** — top-3 recommendations
   promoted to the narrative spine. Each: plain-English claim, the
   evidence (collapsed `<details>` or tab under it, reusing existing
   section components), named competitors inline, and the SAME closing
   motion: "LeaseStack fixes this → Book 15 min" (BookDemoLink).
3. Everything else demoted to an appendix accordion ("Full scorecard",
   "All 18 mentions" collapsed to top-3 + count, "How this was built").
4. Narrative: strip markdown (`#`, `**`) in the renderer TODAY (bug),
   and tighten the synthesize prompt: 3 sentences max, no score
   recitation, second person, one concrete number per sentence.
5. Design voice: same as /ai-visibility (Atmosphere, display type,
   ls-hl highlight, Carbon blue, mono numerals). No identical card
   grids, no side-stripe borders.
6. Keep `#ai-search` anchor working (ai-visibility deep-links to it).

Files: `app/(platform)/audit/[token]/page.tsx` (620 lines) + components
in `components/audit/`. Verify with design-qa script in
`.claude/design-qa/` (axe + screenshots, already working).

## Slice 2 — Chatbot builder magnet (`/build-a-chatbot`)

The wow magnet: prospect enters property website → live chatbot trained
on their property, on the page → email to keep it → book Norman.

- Machinery EXISTS: `/onboarding` renders `PublicChatbotOnboarding`
  (`components/onboarding/public-chatbot-onboarding.tsx`) — logged-out
  chatbot config + preview, no account. Reuse its scrape/preview parts;
  do NOT fork the trial wizard flow.
- Page shape: hero (ls-hl highlight, "Your property's leasing agent,
  built in 60 seconds"), URL input → scraping progress theater →
  live chat preview panel (their name/colors if derivable) → gate:
  name+email ("email me the install snippet") → book-call close +
  BookCallCta sticky.
- Lead storage: IntakeSubmission via `/api/onboarding` (selectedModules:
  ["chatbot"]) — shows in /admin/intakes + Slack, same as /book-demo.
- Nav Product menu + sitemap + route from /features/chatbot CTA.

## Slice 3 — Reputation front door (`/reputation-report`)

Clone of the /ai-visibility pattern (half day):

- Same form component family (name/email/property/website → 
  /api/audit/start with email) — extract shared pieces from
  ai-visibility-form if trivial, else copy (it's 300 lines).
- Hero: "18 people talked about your property last quarter. Renters
  read all of it." — animated mention-feed mock (Yelp/Reddit/Google
  cards cycling, one flagged negative) in the AiAnswerDemo style.
- Report: same `/audit/[token]`, add `#reputation` anchor on the
  mentions section (mirror of #ai-search).
- Nav + sitemap + cross-link from /audit.

## Slice 4 (1 hour) — Lost-lead calculator (`/lost-leads`)

Pure client math page for the pixel pitch: monthly visitors + leads in →
"~X renters/mo left unnamed" (use the 95%+ anonymous stat from
PRODUCT.md claims that are grounded). Email gate to send the math →
IntakeSubmission (selectedModules: ["pixel"]). Lowest priority.

## Outreach routing (for the cold campaigns)

- Property, AI angle → /ai-visibility
- Portfolio/company, broad → /audit
- "Try your own chatbot" → /build-a-chatbot (slice 2)
- "Your reviews are hurting you" → /reputation-report (slice 3)
- Pixel/visitor-ID angle → /lost-leads (slice 4)

## Standing cautions

- Concurrent sessions share this checkout — 5 chatbot-learning files
  were dirty last session (NOT ours, do not stage): __tests__/
  chatbot-learning-client-polish.test.ts, app/portal/chatbot/page.tsx,
  app/portal/conversations/insights/page.tsx, lib/chatbot/
  conversation-analytics.ts, lib/chatbot/learning/run.ts.
- Footer color-contrast fails AA sitewide (#6f7a94 at 11px, 4.29:1) —
  pre-existing, one-line fix, do it in slice 1 while touching nothing
  else in the footer.
- `/audit` is Tier-1 (lead capture) per AGENTS.md — safe-feature-slice
  applies to slices 1-3.
- Ship path: verify (tsc + vitest + build) → exact-stage → cap. Vercel
  builds cost money; batch commits per slice.
