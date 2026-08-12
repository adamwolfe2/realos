# Respage Gap Analysis

Date: 2026-08-11

## Context

Adam is talking with Respage and wants to understand what LeaseStack can learn from their product surface. This memo compares Respage's public positioning against the current LeaseStack repo.

Sources reviewed:
- https://respage.com/our-solutions/
- https://respage.com/our-solutions/ai-leasing/
- https://respage.com/our-solutions/chatbot/
- https://respage.com/our-solutions/smart-leasing-platform-crm/
- https://respage.com/our-solutions/reputation-management/
- https://respage.com/our-solutions/review-booster/
- https://respage.com/our-solutions/google-business-profile/
- https://respage.com/our-solutions/apartment-websites/
- https://respage.com/our-solutions/events-and-amenities/
- https://respage.com/our-solutions/surveys/
- https://respage.com/partnerships-integrations/

## Respage Product Map

Respage is selling a unified multifamily operating layer, not one isolated tool. Public pages group the product into:

- AI leasing assistant: instant responses, FAQ answering, tour scheduling, cold-lead nurture, SMS/email/web chat/social/ILS/phone coverage, AI voice, resident chatbot, sister-property suggestions, waitlists, multilingual chat, analytics.
- Smart Leasing CRM: prospect + resident communication, email/text/calling, call tracking, centralized calendar, lead scoring/tracking, AI assistant, resident chatbot, workflows, analytics, renewal prediction, affordable-housing waitlist and custom CTA flexibility.
- Reputation: aggregate Google/Yelp/Facebook/Apartments.com/etc., alerts, filters, internal collaboration, AI fair-housing-aware response drafts, approval workflow, optional full-service team.
- Review Booster: automated resident review request cadences tied to PMS data, dashboard visibility, review generation as SEO/local-search lever.
- Surveys: automated resident satisfaction surveys triggered by lifecycle events, issue detection before public negative reviews, sentiment/retention loop.
- Google Business Profile: automated real-time availability/listing posts from PMS, custom content, local SEO lift.
- Websites: mobile-first apartment websites, current pricing/availability from PMS, schema and AI-search-readable property data, campaign landing pages, quick launch/custom design, ongoing maintenance.
- SEO/GEO/AIO + PPC + social advertising + social media: agency/service layer around campaigns and content, with reporting.
- Events and amenities: resident amenity/event booking, reminders, conflict prevention, RSVPs, waitlists, security codes, waivers, feedback.
- Integrations: broad PMS partner list: AMSI, AppFolio, Entrata, Knock, MRI, RealPage, Rent Manager, RentCafe, ResMan, Yardi; certified Google/Meta/RealPage posture.

## LeaseStack Current Overlap

LeaseStack already has meaningful overlap:

- Portal surfaces: leads, visitors, tours, applications, residents, renewals, work orders, conversations, chatbot, reputation, SEO, ads, attribution, audiences, reports, notifications, site builder, popups, vault.
- AppFolio sync exists for residents, leases, work orders, applications, listings/availability and property data.
- Chatbot config exists with embed snippet, persona, greeting/follow-up, brand color, knowledge base, capture mode, lead routing, analytics and prospect intel.
- Lead notifications fire from chatbot, popup, public form, tour, ingest, Cursive, visitor conversion, and manual lead creation.
- Reputation has portfolio rollup, source filters, sentiment, property health, scans via Google/Yelp/Reddit/Tavily, and module gating.
- SEO/AEO is stronger than a normal early product: DataForSEO, GSC, GA4, Google Ads, Meta Ads, AEO engines, recommendations, content drafts, neighborhood pages.
- Site engine and hosted tenant site config exist, including listings, floor plans, amenities, reviews toggle, blog toggle, chatbot/pixel, metadata, and custom domains.
- Attribution and Cursive identity pixel are a differentiator Respage does not emphasize publicly.

## Genuine Gaps

### 1. LeaseStack has dashboards, but less "does the work" automation.

Respage's strongest pattern is task automation around every renter/resident step. LeaseStack tracks, scans, reports, and notifies well. It should add opinionated workflows that act on the data: follow-up sequences, review requests, survey triggers, GBP posts, tour confirmations, escalation queues.

### 2. Multi-channel leasing coverage is incomplete.

LeaseStack has web chatbot, lead email/SMS composer, tours, notifications, and ingest. Respage claims web chat, forms, email, SMS, phone, ILS, Facebook Messenger, and AI voice as one lead response fabric. The gap is not one channel; it is one normalized conversation timeline and automation engine across all channels.

### 3. PMS breadth is narrow.

LeaseStack is deep on AppFolio. Respage markets Yardi, RealPage, Entrata, AppFolio, MRI, ResMan, Rent Manager, RentCafe, AMSI, Knock. LeaseStack should not chase all of these at once, but the product story needs a clean provider registry and at least "AppFolio live, Yardi/Entrata/RealPage planned/CSV bridge" credibility.

### 4. Reputation lacks the response/request flywheel.

LeaseStack scans and summarizes reputation. Respage operationalizes it: alerts, AI response drafts, approval workflow, publishing, review request cadences, survey-to-review loop. LeaseStack has a `review-request-button` in lead components, but the system does not appear to have a resident lifecycle review booster.

### 5. Resident experience is present but not productized.

LeaseStack has residents, renewals, work orders. Respage has resident chatbot, surveys, events/amenity booking, renewal sentiment prediction. LeaseStack can beat them on intelligence, but needs a resident engagement package that feels coherent.

### 6. GBP/local inventory posting is a high-leverage missing wedge.

Respage uses PMS availability to post live units/floor plans/pricing to Google Business Profile. LeaseStack already has AppFolio availability/listings and Google OAuth infrastructure. This is one of the most obvious "copy now" ideas because it fits the existing data graph.

### 7. Leasing calendar and tour workflow need to become first-class.

LeaseStack has tour records and public booking, but Respage treats the calendar, confirmations, reminders, and team visibility as a core CRM promise. This matters because "tour scheduled" is the handoff point between AI and the onsite team.

### 8. Reporting can be more action-oriented.

LeaseStack has reports and insights. Respage's public reporting language focuses on source-to-conversation/tour/application/lease and property-level ROI. LeaseStack should make every report answer: which channel created leases, what to do today, and what automation will run next.

## What To Take

### Copy immediately

- "Operating cockpit" framing: every lead/resident/review/event is one timeline with next best action.
- Review request cadences: passive/moderate/aggressive, triggered by move-in, maintenance close, renewal, tour, positive survey.
- AI reputation replies: fair-housing-safe draft, brand voice rules, escalation rules, do-not-say rules, approval mode.
- GBP availability autoposting: open units/floor plans/pricing from AppFolio several times weekly.
- Sister-property suggestions and waitlists for no-availability chats.
- Chatbot analytics tied to downstream outcomes: conversations, leads, tours, applications, leases, by source.
- Resident support mode inside chatbot: common resident questions, links, maintenance routing, project updates.
- "Team knowledge base" mode: internal staff asks questions against property docs/policies.

### Copy selectively

- AI voice: valuable, but expensive/risky. Prototype through a partner only after text channels and handoff flows are solid.
- Broad PMS marketplace: important for enterprise sales, but AppFolio depth + CSV/API ingest is enough short term.
- Amenity/event scheduling: useful for retention, but not core to LeaseStack's current leasing-intelligence promise.
- Full-service agency claims: do not copy unless Adam decides LeaseStack is managing campaigns/content, which current project memory says not to do.

### Avoid

- Becoming a property-management system. LeaseStack should remain "track and accelerate leasing outcomes," not "manage operations."
- Copying Respage's whole surface at once. They have 20+ years and service teams; LeaseStack should win with intelligence, speed, and a focused wedge.
- Over-indexing on social media management. Respage has legacy/service strength there; LeaseStack's stronger wedge is attribution + AI search + leasing automation.

## Recommended Roadmap

### Slice 1: Leasing Action Center

Goal: make LeaseStack feel like it does the next step, not just shows data.

Build:
- Unified lead/resident/conversation timeline.
- Next-action queue: hot leads, stale contacted leads, tour no-shows, post-tour follow-up, negative review, positive survey candidate.
- One-click actions: send SMS/email, mark handoff, schedule tour, request review, add to waitlist, suggest sister property.
- Automation audit log so operators trust what ran.

### Slice 2: Review Booster + Survey Loop

Goal: close the biggest reputation gap.

Build:
- Review request campaign settings per org/property.
- Cadences: passive/moderate/aggressive.
- Triggers: move-in +30d, work order closed, renewal signed, positive manual note/survey, post-tour/app outcome.
- Simple resident pulse survey with negative-feedback suppression/escalation before public review ask.
- Reputation response drafts with fair-housing guardrails and approval workflow.

### Slice 3: GBP Availability Autopost

Goal: high-leverage distribution from data LeaseStack already has.

Build:
- Google Business Profile connection per property/location.
- AppFolio listing-to-GBP post generator.
- Approval queue first, autopost later.
- Post history and lead attribution tag.
- Copy rules for fee transparency and availability expiration.

### Slice 4: Multi-Channel Conversation Fabric

Goal: Respage-level channel story without overbuilding.

Build:
- Normalize web chatbot, forms, tours, manual leads, SMS/email replies into one conversation model.
- Add outbound follow-up sequences for new lead, stalled lead, tour scheduled, post-tour, application abandoned.
- Add channel health and SLA reporting.
- Defer phone/voice to partner integration.

### Slice 5: Resident Support Mode

Goal: productize the resident side without becoming a PM system.

Build:
- Resident chatbot mode using property docs, FAQs, payment/maintenance links, community updates.
- Work-order routing where available from PMS.
- Renewal risk signal from resident touchpoints, surveys, open work orders, sentiment.
- Staff knowledge-base assistant as a portal tool.

## Positioning Recommendation

Do not position LeaseStack as "Respage but new." Position it as:

> LeaseStack is the intelligence and automation layer that shows multifamily teams what is creating tours, applications, leases, reputation risk, and AI-search visibility, then runs the next leasing action.

Respage's moat is breadth, service, and integration history. LeaseStack's moat should be sharper:

- attribution from anonymous visitor to lead/lease,
- AI-search visibility and AEO,
- AppFolio-first operational depth,
- faster implementation,
- action queue + automation instead of another dashboard.

## Sales Notes For Respage Conversation

Ask specifically:
- Which channel drives the most ResMate conversions today: web chat, SMS, email, ILS, Messenger, or phone?
- How do they map conversations to tours/applications/leases across PMS/CRM data?
- How much review response is AI self-serve vs human-managed service?
- What does their GBP posting actually publish: product posts, updates, offers, floor plans, or individual units?
- What are the failure modes in PMS integrations: stale availability, duplicate prospects, consent, attribution, or leasing-team adoption?
- Which features clients actually use weekly after onboarding?
- What are clients replacing: Knock, Funnel, Anyone Home, EliseAI, apartment website vendors, agency retainers, or all of the above?

