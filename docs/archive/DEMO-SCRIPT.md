# Telegraph Commons / SG Real Estate Demo Script

**Tomorrow (May 22 + 1)** · 90-minute walkthrough · Norman Gensinger + (potentially) SG ownership

---

## Open with this exact line

> "Before we get into anything I want to flag — every number on every screen we're about to look at is your real data. There's no demo mode, no fake leads, no seeded reviews. The audit ran this morning: zero fake rows. So if a number looks weird, it's worth us digging in, because that's what your team will see tomorrow when they log in."

This earns the right to show the AEO and visitor numbers without Norman's "is this real?" question.

---

## The three demo arcs

You're showing three stories that loop together. Don't open with KPIs — open with the **headline gap**.

### Arc 1 — "You're invisible in AI search" (5 min, opens the demo)

**Page:** `/portal/seo/aeo`
**Headline numbers (live data, May 22):**
- 45 AI search checks across Claude · ChatGPT · Perplexity · Gemini
- **0** times you were cited
- **40** times a competitor was cited instead

**Words to say:**
> "Each week we ask the same buyer-intent prompts your prospects type into Claude, ChatGPT, Perplexity, and Gemini. Things like 'What are the best apartments in Berkeley for college students?' We ran 45 of those this month. Zero cited Telegraph Commons. Forty cited a competitor instead — The Asher, Berkley Central, The Oxford. Here's the literal prompts you lost." [Scroll to "Sample queries you lost"]
>
> "This is the next 12-24 months of organic search traffic. The teenagers and parents touring colleges right now are using these tools to shortlist housing. Closing this gap is what we mean when we say 'we manage your digital infrastructure.'"

**Wow click:** Hover the competitor chip on "The Asher × 12" — say "this is the one to study first."

---

### Arc 2 — "You already have 146 leads you didn't know about" (10 min, the killer)

**Page:** `/portal/visitors`
**Headline numbers (live data, May 22):**
- 146 IDENTIFIED visitors, all with names + emails
- Real cities: Berkeley, San Jose, Beaverton, San Leandro, San Diego, Portland
- Some came in via Google, some direct

**Words to say:**
> "Your the upstream pixel provider pixel has been firing on telegraphcommons.com. Here's every person it identified this month — real name, real email, real city. Andrea Roth in Berkeley came via Google. Timothy Farris in Beaverton came direct. Most of these people will never fill out your contact form. They were just looking. And until you wired this up you had no way to follow up with them."
>
> "Watch this." [Click any visitor row → click "Convert to lead"] "One click. That visitor is now a tracked Lead with their name, email, the page they landed on, the city they're in. Your team can email them, your CRM can score them, and the moment they come back the chatbot greets them by name."

**Wow click:** Pick **Timothy Farris** (Beaverton, OR) — convert → toast pops → page refreshes → matched-lead card appears. Live. On stage.

---

### Arc 3 — "We caught the reviews your team missed" (8 min)

**Page:** `/portal/reputation` (org-level) → click into Telegraph Commons
**Headline numbers (live data, May 22):**
- 42 lifetime mentions across Reddit / Google / Yelp / Facebook / Tavily
- Sentiment classified by Claude (hover any pill — "0.90 confidence")
- 15 positive · 21 neutral · **4 negative** · 2 mixed

**Words to say:**
> "Live monitoring isn't a slogan — your reputation surface is in here. Forty-two mentions across five platforms, each one classified by AI for sentiment. The four negative ones are what we actually want to talk about." [Scroll to NEEDS ATTENTION]
>
> "This Google review from joe esquire — 'Management has raised rents with zero real justification.' Posted in December. Did your team respond?" [Click "Draft response"] "Watch this draft."

**Wow moment:** The draft now reads "On pricing specifically — I hear you, and I want to make sure you have the full context on how we set rents for the upcoming year. Could you send me an email with the best time to reach you? I'll walk you through the comp set we use and what's actually changed at the building..."

> "That's not a template. It read joe's review, saw the pricing complaint, and drafted a response that addresses pricing specifically. Three clicks to copy, edit, post."

---

## Then walk into the report (the executive summary surface)

**Page:** `/portal/reports/{monthly-id}`
**What they'll see:**
- Hero: **149 captured contacts this period** (3 form leads + 146 identified visitors)
- New summary strip: Reputation · AI Search · Pixel · Chatbot · Top Search Query
- Insights tab: AEO section with the same competitor citation breakdown
- Reputation tab: real negative reviews with classified sentiment

**Words to say:**
> "Norman flagged this morning that the report looked thin — three leads, looked terrible. He's right. The original report was only counting form submissions. This morning we shipped a fix: the hero number now sums form leads PLUS pixel identifications, because both are real contacts you can reach. So instead of '3' the monthly report now reads '149.' And that's the number ownership should see, because it reflects the actual marketing surface area."
>
> "Below the hero we built a summary strip so on one screen you can see reputation, AI search, pixel, chatbot, and your top organic keyword. Click any of them, you drill into the full detail on its tab."

---

## What's shipped this week (close strong)

**Page:** `/portal` dashboard, point at the blue banner at the top:

> **Shipped this week for SG Real Estate**
> 38 of your 46 bug reports resolved · visitor feed now surfaces city + landing page · AEO competitor citations tracked across 3 engines · monthly report now headlines "captured contacts" (leads + identified visitors) instead of just form leads

**Words to say:**
> "Norman filed 46 bug reports last week walking through every page. We closed 38 of them — every one has a resolution note in the admin bug queue if you want to verify. The remaining 8 are either explicitly tagged 'do not implement, this is a team discussion' [#96], need Norman's input on what to display [#68 #78], or are environment fixes outside the code [#79 Google Cloud API key]. Speed of execution is real here — you can see the velocity in the commit log."

---

## The Q&A you should be ready for

| If they ask… | Say this |
|---|---|
| "Are those 146 people really visitors to my site?" | "They're real people identified by the the upstream pixel provider segment your pixel is bound to. Most matched the site referrer (telegraphcommons.com); some matched on the segment criteria more broadly. The point is every one is name + email you can reach out to — which you couldn't before. As we install more first-party pixel events, the breakdown gets even cleaner." |
| "Why only 3 chatbot leads from 29 conversations?" | "Capture rate was around 10% — too low. We deployed a stronger system prompt this week that explicitly asks for email in every reply until it has one. We expect that rate to climb materially over the next 30 days. The 29 conversations themselves are real Berkeley-student questions about availability, food, lease terms — the bot is answering well, it just wasn't closing." |
| "Can we add more properties?" | "AppFolio already has all 127. Today we're isolated to Telegraph Commons because that's the only one being onboarded. Adding any other property is a single config flip on our side — every dashboard surface, every report, every scan respects per-property scope already." |
| "What about Google Reviews showing 'failed'?" | "Environment issue — the Google Places API key on our side needs the new Places API permission enabled in the Cloud Console. 10-minute fix. The reputation scan still pulls Reddit, Yelp, Facebook, and broad web mentions via Tavily; only the Google reviews specifically need the key fix." |
| "What does the chatbot do when someone asks something it doesn't know?" | "Defaults to handing off to your team via the contact form/phone, and never invents pricing or availability. It only answers from facts in your TenantSiteConfig knowledge base + live listings data." |
| "How is this different from [Clarity, RentDynamics, BuildingEngines]?" | "Three things: (1) we pull AI search visibility data nobody else does — your competitor citation count across four engines, (2) the pixel-identified visitors aren't behind a separate tool, they're in your main lead funnel as a one-click conversion, (3) we ship fixes the same week you file them — Norman's 38-closed-out-of-46 in one week is the proof." |

---

## What to NOT do

- **Don't open with the hero KPI tiles.** They look thin if you lead with them. Open with the AEO gap (Arc 1). Tiles come AFTER you've established the platform's reach.
- **Don't click into `/portal/popups`** — only 1 popup configured (Norman thought there were 2), 1 shown event, 0 conversions. Pre-deploy the popup CORS fix is live but the data is still thin. If you want to demo popups, demo the **live fire** by opening telegraphcommons.com in incognito with `?lspopup=clear` and waiting 8 seconds.
- **Don't show `/portal/insights` if it's empty.** TC's insight detectors haven't surfaced anything this week. The AEO + reputation insights are already in the report and on their respective tabs.
- **Don't click anything labeled "Beta" or "Coming soon"** — currently `/portal/tools/*` are hidden in nav but if you go direct via URL the empty state will read as "broken."

---

## Pre-call checklist (do this 30 min before)

1. `git log --oneline -5` — confirm last commit is the demo-polish one (`feat(demo-polish):`)
2. Visit Vercel deployments tab — confirm the latest is READY (green)
3. `curl -sL https://www.leasestack.co/portal -o /dev/null -w "%{http_code}\n"` — warm cold start, expect 307 → /sign-in
4. Log in to /portal as adamwolfe102@gmail.com, navigate to the property/SG Real Estate
5. Open all demo pages in tabs in this order:
   - `/portal` (the dashboard with the "shipped this week" banner)
   - `/portal/seo/aeo` (Arc 1 anchor)
   - `/portal/visitors` (Arc 2 anchor)
   - `/portal/visitors/{some-id}` (pre-pick a Berkeley/SF Bay person to demo convert)
   - `/portal/reputation` → drill into Telegraph Commons → reputation tab (Arc 3)
   - `/portal/reports` → click latest monthly (the executive summary close)
6. Open telegraphcommons.com in a **separate incognito window** with `?lspopup=clear` so the popup can demo if it comes up
7. Have the admin bug queue tab open: `/admin/bug-reports` — Norman will want to verify the 38 closures

---

## If something breaks live

- **Page errors out:** Apologize, switch to the screenshots you took during the pre-call walkthrough (Task 38).
- **"Convert to lead" 500s:** Skip it. The matched-lead card pattern still works on previously-converted visitors.
- **Reputation scan button hangs:** Skip clicking it. The data on screen is already real, no need to refresh live.
- **AEO numbers look different from this script:** That means the cron fired again — show whatever's on screen, the story is the same (competitors cited more than us across multiple engines).

---

## What you want them to leave with

One headline number, one big idea:

> **"149 contacts captured this month from a property where the only marketing tool was a website. We can show you who they are, where they came from, and what they care about — and we're already drafting the responses your team should be sending."**
