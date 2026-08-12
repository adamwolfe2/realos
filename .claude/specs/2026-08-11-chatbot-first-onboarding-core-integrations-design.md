# Chatbot-First Onboarding + Core Integrations Design

Date: 2026-08-11

## Goal

Lower signup friction so a new operator can test LeaseStack quickly, usually through the chatbot, then discover the deeper platform naturally. The product should not feel like a collection of add-ons. It should feel like one leasing command center where every capability either makes the chatbot smarter, turns chatbot demand into action, or proves which actions create tours/applications/leases.

This design follows Adam's direction:

- no services-first positioning,
- no full-service agency language,
- no property-management-system sprawl,
- chatbot is the first "aha",
- Respage-inspired capabilities become core integrations in the UI, not fluff.

## Product Thesis

LeaseStack should onboard users through the fastest credible proof:

> "Paste your property website. Test the AI leasing assistant. Then connect the pieces that make it smarter and more accountable."

The onboarding path should not start with a feature cart. A curious operator does not know yet whether they want reputation, GBP, review requests, attribution, surveys, or resident support. They know they want a better leasing chatbot. Once they see the chatbot, the rest of the platform can be framed as the system around that assistant.

## Current Friction

Current onboarding is already no-card and trial-first:

1. workspace,
2. features,
3. properties,
4. done.

The friction is ordering. Users must pick feature modules before value. The "features" step is a pricing/catalog decision, which belongs after the user has seen a working surface.

Portal welcome also pushes broad setup tasks:

- open property,
- connect AppFolio/PMS,
- build marketing site,
- book walkthrough.

That is useful for an already-convinced buyer, but heavy for a user who only wants to test the chatbot.

## Recommended Approach

Use a **chatbot-first trial path** with progressive activation.

### First-Run Flow

1. User signs up.
2. Workspace asks for:
   - company/workspace name,
   - property website URL,
   - optional property name if the URL cannot be parsed.
3. LeaseStack creates:
   - org,
   - first property,
   - chatbot config,
   - starter knowledge base from the website crawl when available,
   - sample lead/transcript/demo state if live data is not available yet.
4. User lands in **Chatbot Launchpad**, not the generic dashboard.
5. Launchpad shows:
   - live chatbot preview,
   - editable greeting/persona/knowledge,
   - install snippet,
   - "test as prospect" conversation,
   - captured lead/transcript preview,
   - next integrations that directly improve the chatbot.

### Why This Wins

- URL-only is enough to start.
- PMS is helpful but not required.
- Pricing and module shopping can wait.
- The user sees the product before configuring the business model.
- Every integration has a reason tied to the chatbot or leasing outcomes.

## Alternative Approaches Considered

### A. Keep Feature Cart, Improve Copy

This is the smallest change, but it still asks users to select tools before they understand the product. It is better for sales-qualified buyers than curious self-serve users.

### B. PMS-First Onboarding

This creates high-quality data fast for serious operators, but it is the wrong first ask. Credentials, PMS admin permissions, and report availability introduce too much friction.

### C. Chatbot-First Launchpad

Recommended. It gives value with a URL, then exposes PMS, reputation, GBP, surveys, review requests, attribution, and follow-up automation as connected jobs around one assistant.

## New Information Architecture

The portal should gradually converge around a central **Leasing Command Center**.

Primary jobs:

- Answer prospect questions.
- Capture leads.
- Schedule tours.
- Follow up.
- Request reviews.
- Monitor reputation.
- Publish availability.
- Attribute outcomes.
- Learn from conversations.

Instead of presenting these as independent modules, the UI should group them around the lead/resident lifecycle.

### Command Center Tabs

1. **Launch**
   - chatbot status,
   - install snippet,
   - property knowledge,
   - website/PMS connection status,
   - test conversation.

2. **Inbox**
   - chatbot conversations,
   - form leads,
   - tour requests,
   - SMS/email replies when connected,
   - handoff status,
   - one unified timeline per prospect/resident.

3. **Actions**
   - hot leads,
   - stale contacted leads,
   - tour no-shows,
   - post-tour follow-ups,
   - review request candidates,
   - negative review/escalation items,
   - GBP post opportunities,
   - waitlist and sister-property suggestions.

4. **Automations**
   - lead follow-up sequences,
   - tour confirmations/reminders,
   - review request cadences,
   - survey triggers,
   - GBP availability drafts,
   - escalation rules.

5. **Reputation**
   - review/mention inbox,
   - response drafts,
   - approval workflow,
   - review booster performance,
   - survey feedback before public review ask.

6. **Performance**
   - conversations,
   - leads,
   - tours,
   - applications,
   - signed residents where PMS data exists,
   - attribution by source and property,
   - chatbot question gaps.

This does not require deleting existing nav immediately. The first implementation can add a focused launchpad and action center while existing pages remain reachable.

## Core Integrations To Productize

### 1. Website URL Ingest

Purpose: make the product usable without PMS.

Inputs:

- property website URL,
- optional property name,
- optional market/city.

Outputs:

- property shell,
- discovered property name/address/phone when possible,
- starter chatbot knowledge base,
- source confidence,
- setup checklist items for missing basics.

UX:

- "Paste your property site" is the main onboarding ask.
- If crawl fails, let the user continue manually.
- Never block signup on crawl success.

### 2. Chatbot Launchpad

Purpose: the first successful user moment.

Includes:

- live preview,
- test prompt bar,
- transcript,
- captured lead card,
- editable knowledge/greeting/persona,
- install snippet,
- install verification,
- "what the bot cannot answer yet" question gaps.

This replaces the generic post-onboarding welcome as the default landing page for users who start with chatbot.

### 3. Leasing Action Center

Purpose: make LeaseStack act, not just report.

Initial action types:

- new high-intent lead,
- chatbot handoff needed,
- stalled lead,
- tour scheduled without confirmation,
- tour completed with no follow-up,
- positive resident candidate for review request,
- negative review needing response,
- GBP availability draft ready,
- website/PMS data gap affecting chatbot answer quality.

Each action has:

- owner/status,
- reason,
- recommended action,
- one-click action when available,
- audit trail.

### 4. Review Booster + Survey Loop

Purpose: close the Respage reputation gap without becoming an agency.

Core flow:

- ask residents simple satisfaction questions,
- route negative/private feedback to team,
- ask positive respondents for Google review,
- track which requests produce reviews,
- draft responses for new reviews with fair-housing-safe guardrails.

Initial triggers:

- manual lead/resident selection,
- resident move-in + configured delay,
- work order closed,
- renewal signed,
- positive survey response.

This belongs inside Reputation and Actions, not as a detached "reviews product."

### 5. GBP Availability Autopost

Purpose: turn existing availability/listing data into local-search action.

Flow:

- connect Google Business Profile,
- map property to GBP location,
- generate availability/floor-plan/update drafts,
- approval mode by default,
- post history,
- attribution tag when leads arrive after a post.

Start with drafts only. Autopost can come after operators trust the copy.

### 6. Multi-Channel Conversation Fabric

Purpose: one timeline for every lead interaction.

Sources:

- chatbot,
- forms,
- tours,
- manual leads,
- ingest API,
- SMS/email replies when connected,
- future ILS/webhook sources.

The first slice does not need full two-way email/SMS automation. It needs a normalized timeline and clear source labels so the platform can later add sequences without rewriting the model.

### 7. Resident Support Mode

Purpose: add resident value without becoming a PMS.

Capabilities:

- resident FAQ assistant,
- maintenance/payment/portal links,
- community policy answers,
- renewal question routing,
- resident survey prompt,
- handoff to team.

Do not build amenity booking first. Keep resident support focused on questions, routing, sentiment, and renewal risk.

### 8. Outcome Attribution

Purpose: prove that the chatbot and automations drive leasing outcomes.

Dashboards should tie:

- source,
- conversation,
- lead,
- tour,
- application,
- signed resident when PMS exists.

If PMS is not connected, still show partial funnel through lead/tour/application fields LeaseStack controls.

## Onboarding Design

### Step 1: Create Workspace

Fields:

- workspace/property company name,
- property website URL,
- property type defaulted to Residential / Multifamily unless user changes.

CTA:

- "Build my chatbot preview"

System behavior:

- create org if needed,
- create or update first property,
- queue website ingest,
- enable base platform + chatbot + conversations by default for trial,
- start trial only after the preview is created or skipped.

### Step 2: Chatbot Preview

Content:

- "Here is what your assistant knows so far."
- preview card,
- sample prompts,
- editable knowledge gaps.

CTA choices:

- "Install on my site"
- "Keep testing in dashboard"
- "Connect AppFolio / PMS"

The user can continue even if ingest is still running.

### Step 3: Launchpad

This is the first portal destination.

Primary checklist:

- Test the bot.
- Edit greeting.
- Add missing answer.
- Install snippet.
- Send yourself a test lead.
- Connect data source when ready.

Secondary "make it stronger" integrations:

- Sync availability from PMS.
- Connect Google Business Profile.
- Turn on Review Booster.
- Add follow-up automations.
- Connect attribution sources.

## Pricing / Packaging Implication

For onboarding, default to:

- base platform,
- chatbot,
- conversations,
- lead capture,
- basic action center,
- limited reputation scan or preview,
- limited report preview.

Do not show a broad module cart before trial activation.

Inside the app, show upgrade prompts contextually:

- need ongoing reputation monitoring -> activate Reputation,
- need review request campaigns -> activate Review Booster,
- need GBP posting -> connect/activate GBP,
- need attribution -> connect analytics/pixel/PMS.

This keeps the signup path frictionless while preserving monetization.

## UI Rules

- No "marketplace of add-ons" language in first-run.
- No agency/service claims.
- No "we manage your ads/content" copy.
- Every card must answer one of:
  - what the assistant can answer,
  - what needs attention,
  - what action will run,
  - what outcome happened.
- Integrations are shown as data sources or action channels, not as decorative feature tiles.
- Empty states should offer a concrete next action, not explain the feature.

## Implementation Slices

### Slice 1: Chatbot-First Onboarding

Replace onboarding order:

- workspace + URL,
- chatbot preview,
- launchpad.

Retain existing property/manual/PMS capability behind "connect data source."

### Slice 2: Launchpad

Build `/portal/launch` or repurpose `/portal/chatbot` top section:

- preview,
- setup checklist,
- install snippet,
- test lead,
- knowledge gaps,
- next integrations.

Route new chatbot-first users there after signup.

### Slice 3: Action Center

Build `/portal/actions` or a dashboard panel:

- action model,
- initial detectors from existing leads/conversations/reputation/tours,
- status/owner,
- action audit.

### Slice 4: Review Booster + Survey Loop

Add resident/review request cadences:

- campaign settings,
- recipient selection,
- survey capture,
- negative feedback escalation,
- positive review ask,
- reputation response drafts.

### Slice 5: GBP Availability Drafts

Add GBP connection/mapping/draft queue:

- property-to-location mapping,
- AppFolio/manual listing source,
- approval workflow,
- post history.

### Slice 6: Conversation Timeline Foundation

Normalize event history across:

- chatbot,
- lead notes,
- tours,
- SMS/email composer sends,
- manual status changes,
- future inbound replies.

## Data / Architecture Notes

- Website ingest can reuse existing site intelligence / crawl infrastructure where possible.
- Chatbot config already supports property-level overrides and knowledge base fields.
- Lead notification infrastructure already spans chatbot, popup, form, tour, ingest, visitor convert, and manual.
- Existing reputation models can back the first review/action surfaces.
- Existing AppFolio listings/residents/work orders/leases can power PMS-triggered review and GBP workflows.
- Action Center should have its own persisted action/audit model rather than deriving every row at render time; detectors can upsert actions idempotently.

## Risks

- Website crawl quality may be uneven. Mitigation: allow manual edit and never block trial.
- Chatbot preview can overpromise if source knowledge is thin. Mitigation: show "unknowns" and make missing answers editable.
- Review requests can create compliance risk. Mitigation: opt-in campaigns, templates, suppression rules, audit trail.
- GBP posting can publish stale availability. Mitigation: approval mode first, expiration dates, PMS freshness warning.
- Action Center can become noisy. Mitigation: start with fewer, high-confidence action types.

## Success Criteria

- A new user can reach a working chatbot preview from signup with only a website URL.
- A new user does not have to choose a module package before seeing product value.
- First portal destination has a clear next action in under 10 seconds.
- The chatbot page explains and launches at least three deeper platform loops: PMS availability, review booster, and attribution.
- New core integrations feel operational: they live in launch/actions/reputation/performance workflows, not in a detached add-on grid.

