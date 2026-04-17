## **The 3-track plan (MVP → Shopify B2B → Headless), built to scale TBGC from "CEO phone ops" into a real distribution machine**

You're going to run three implementations in parallel:

1.  Lovable/v0 MVP to sell the vision + validate flows fast

2.  Shopify B2B as the durable "operating core" (catalogs, pricing, net terms, ordering)

3.  Headless as the premium portal layer once you're printing revenue and need custom UX + deep ops automation

# **Track 1 --- MVP in Lovable + v0 by Vercel (7--14 days)**

### **What you build (MVP goals)**

Goal: Demo + pilot with 10--25 accounts, prove reorder + pricing rules + order capture, and build trust fast.

MVP pages

-   Marketing site

    -   Hero + trust + "Always Fresh, Never Frozen"

    -   "Request an account" (B2B gate)

    -   Category landing pages (Truffles / Caviar / Salumi / Pantry / Proteins)

    -   Seasonal drops page ("White truffle season / holiday caviar")

-   Portal (logged-in prototype)

    -   Account dashboard (last order, reorder, rep contact)

    -   Catalog browsing + search + favorites

    -   Simple cart + checkout request (in MVP this can be "submit order request")

    -   "Reorder last order" button

-   Admin

    -   Accounts list + approval

    -   Products list (CSV upload)

    -   Orders list (status tags + notes)

### **MVP tech stack**

-   UI + flows: Lovable + v0-generated components (Tailwind/shadcn patterns)

-   Auth: "magic link" + manual approvals (MVP-grade)

-   Data: Airtable (fast), or Supabase if you want cleaner handoff later

-   Payments (MVP): Stripe payment link or draft invoice (no full checkout yet)

### **MVP "killer demo" features (makes them sign)**

-   Account request → approval → instant login

-   Reorder in 10 seconds (last order → 1 click → confirm)

-   Chef Kits / Bundles page with 3--5 prebuilt packs

-   Rep-assisted ordering: rep can build a cart "for" a client

Output of Track 1: a clean, clickable product that closes the engagement + gets pilot customers using the portal immediately.

# **Track 2 --- Shopify B2B as the "source of truth core" (2--6 weeks)**

This is your backbone. Shopify B2B gives you company accounts, catalogs, pricing rules, quantity rules, volume pricing, and payment terms out of the box.

## **Why Shopify B2B fits TBGC perfectly**

Your product list has:

-   200+ SKUs

-   case-only items

-   minimums/increments

-   seasonal + market-rate volatility

-   prepay / net terms realities

Shopify B2B solves those with:

-   B2B catalogs (product access + customer-specific pricing)

-   Quantity rules (min/max + increments)

-   Payment terms (net 7/15/30/45/60/90, due on fulfillment, deposits)

## **Shopify B2B stack (recommended)**

### **Commerce core**

-   Shopify + B2B catalogs + company profiles

-   Catalog strategy:

    -   Catalog A (Default / New Accounts): prepaid only, standard pricing

    -   Catalog B (Repeat Buyers): improved pricing + limited net terms

    -   Catalog C (A Accounts / VIP): best pricing + allocations + highest credit terms

    -   Catalog D (Hotel / Corporate gifting): bundle-heavy, margin-protected

    -   Catalog E (Retail partners): case packs + MAP-like guardrails

> Note: Shopify allows multiple catalogs per company location (with rules about overlapping pricing).

### **Payments (clean up the chaos)**

-   Primary: Stripe via Shopify payments flow

-   Net terms: Shopify payment terms + deposits

-   Optional later: true "underwritten net terms" provider (if they want it)

### **Shipping & fulfillment**

-   Shipping labels + rate shopping:

    -   ShipStation or Shippo

-   Delivery zones:

    -   Local delivery schedule (truck routes)

    -   Overnight cutoff timers (ex: "order by 2pm for next-day")

-   Cold chain SOP integration:

    -   packing checklist per category (truffles vs caviar vs proteins)

### **Accounting / finance**

-   QuickBooks Online for proper books

-   Auto-sync: orders, refunds, tax, payouts

### **Marketing + lifecycle**

-   Klaviyo for email flows

-   Pixel + analytics:

    -   GA4 + conversion tracking

    -   Meta pixel (when you start paid)

## **Shopify B2B portal features (must-have)**

Account & roles

-   Company → multiple locations

-   Roles: Owner / Chef / AP / Purchasing

-   Approval workflow: "Request account" → verify → assign catalog → go live

Ordering

-   Reorder last order

-   Saved carts ("Weekly Par Cart", "Event Cart")

-   Favorites + search

-   Quantity rules: increments/minimums per SKU

-   Volume pricing breaks (for case buying)

-   Payment terms + deposits for risky categories

Seasonality + market-rate controls

-   "Market rate item" labeling + daily update banner

-   Allocation-only items (visible but gated)

-   Substitution suggestions (if OOS, offer comparable)

# **Track 3 --- Headless portal (premium UX + deep ops automation) (6--16 weeks)**

Once Shopify is the source of truth, you layer a custom portal to get:

-   ultra-clean UX

-   rep-assisted ordering at scale

-   deep automation + dashboards

-   advanced pricing/availability logic

## **Headless stack (battle-tested)**

Frontend

-   Next.js + Tailwind CSS + shadcn/ui (matches v0 output)

Auth

-   Clerk (or Shopify customer auth if you keep it native)

Data layer

-   Supabase (Postgres) for custom objects Shopify doesn't model well:

    -   allocations

    -   "market-rate history"

    -   rep assignments + commissions

    -   call scores + tasks

    -   delivery route planning

    -   knowledge base + SOPs

Integrations

-   Shopify Admin API + webhooks

-   CRM sync (HubSpot/Pipedrive)

-   Telephony (Aircall/Dialpad/OpenPhone)

-   Warehouse/inventory system (if needed)

Why headless matters here

TBGC will want features like:

-   "rep builds order for client" + approvals

-   allocation holds

-   "chef par levels" and standing orders

-   real margin dashboards

-   frictionless reorder experiences\
    > \
    > These become much easier headless once Shopify is stable.

# **The feature universe (copy/paste into your knowledge base)**

## **A) Client Portal (B2B buyers)**

Ordering & catalog

-   B2B login with company + location selection

-   Search with synonyms ("osetra" → "sturgeon")

-   Filters: category, origin, season, pack size, "market rate", "allocation"

-   Favorites + "Chef shelf"

-   Saved carts

-   Reorder last order / reorder by SKU

-   Request quote (for large orders)

-   Reorder reminders (per category cadence)

Commercial controls

-   Catalog pricing by account tier

-   Minimum order qty + increments (case-only enforcement)

-   Volume pricing breaks

-   Payment terms + deposits

-   Credit limit display (for net terms accounts)

Trust builders

-   "Delivery next available" estimator

-   Cold-chain packaging explanation

-   COAs / provenance PDFs (per SKU)

-   "How to store" and "how to serve" cards

## **B) Sales Rep Portal (22 reps → weaponized)**

Rep dashboard

-   Accounts that haven't reordered in 7/14/30/60 days

-   "Next best upsell" recommendations

-   Open quotes + stalled carts

-   Pending approvals / credit holds

-   Allocation inventory alerts

Rep tools

-   "Build cart for client"

-   "Send quote" → one-click accept

-   Auto-generated follow-up tasks

-   Account notes, preferences, birthdays, favorite items

Performance

-   Touches/day, connects/day, quotes/day

-   Orders, AOV, reorder rate, gross margin

-   Pipeline by stage (see CRM section)

## **C) Admin Ops (the engine room)**

SKU management

-   SKU master fields (minimum viable):

    -   sku_id, name, category, unit (oz/lb/g), pack size, case pack, min order, increment, shelf life, storage, origin, "market rate flag", "allocation flag", "prepay flag"

-   Price history log (if market-rate)

-   Substitution mapping (SKU → alternates)

Order ops

-   Order status: received → confirmed → packed → shipped → delivered → issue

-   Exceptions:

    -   temp excursion / delay / substitution request / refund/credit

Fulfillment

-   Pick/pack lists by category

-   Packing SOP prompts (gel packs count, insulation type, label)

-   Cutoff time logic

-   Route planning (local deliveries)

## **D) Knowledge base (what you build later)**

Structure it like this so ops scale:

1.  How ordering works

2.  Payment methods & terms

3.  Shipping timelines & cutoffs

4.  Cold chain SOP

5.  Product handling SOPs (truffles, caviar, proteins)

6.  Sales playbook (scripts, objections, bundles)

7.  Account tiers + pricing logic

8.  Returns/credits policy

9.  Seasonality calendar

10. Partner program

# **CRM + call tracking: exact implementation**

## **CRM options (pick ONE)**

### **1) HubSpot (best for operational truth + reporting)**

-   Great for: lifecycle + dashboards + automation + account-based marketing

-   Integrates with Shopify easily (common patterns)

### **2) Pipedrive (sales-first simplicity)**

-   Great for: reps moving fast, easy pipelines

### **3) GoHighLevel (if you want marketing + automation in one)**

-   Great for: multi-channel automation

-   But commerce still lives in Shopify

## **Call recording + coaching options (pick ONE "system of record")**

-   Gong (enterprise-grade)

-   Or lighter: Aircall/Dialpad/OpenPhone + AI notes

## **CRM pipeline (B2B distribution reality)**

1.  New lead (IG / referral / outbound / event)

2.  Qualified (role verified: chef/AP/purchasing)

3.  Sample/Chef Kit sent

4.  Quote sent

5.  First order

6.  Repeat buyer

7.  A Account (net terms + allocation priority)

8.  Dormant / winback

Automation

-   New IG inbound → create lead → assign rep → task due in 10 minutes

-   Quote sent → 24h follow-up task

-   First order → 7-day reorder prompt + upsell sequence

-   No order in 21 days → winback campaign

# **GTM + distribution channels (destroy through every lane)**

## **1) Use existing fame first (46k IG → owned revenue)**

Instagram funnel

-   Link-in-bio → Account request

-   DM automation:

    -   "Are you a chef / restaurant / hotel / retail?" → route to the right offer

-   "Season drop" countdowns (scarcity works in truffles/caviar)

Offer ladder

1.  Chef Kit (intro pack)

2.  Caviar Flight (3x 30g)

3.  Seasonal Allocation Reserve (VIP list)

4.  Standing Order (weekly/biweekly par)

## **2) Outbound (build a predictable pipeline)**

Tools

-   Clay + Apollo/ZoomInfo equivalent

-   Email sending: Instantly / HubSpot sequences

-   Routing: CRM tasks + rep assignment rules

Target ICP segments (build separate lists)

-   Michelin / fine dining

-   Hotels/resorts (F&B directors)

-   Private clubs

-   High-end caterers

-   Event venues

-   Luxury grocers / specialty markets

-   Private aviation catering

-   Yacht provisioning

-   Corporate gifting decision makers

### **Copy/paste outbound templates**

Restaurant / Chef (email 1)

Subject: Quick source for truffles + caviar (delivered fresh)

Body:

-   We supply chefs with fresh truffles + top-tier caviar, delivered cold-chain, reorderable in minutes.

-   If you want, I can send a small chef intro kit and pricing by account tier.

-   Who handles ordering for you --- you or AP/purchasing?

Hotel / Resort

Subject: Premium ingredients, consistent delivery for banquets + VIP

Body:

-   We support hotels with consistent supply of caviar/truffles/specialty items for banquets, VIP amenities, and seasonal menus.

-   We're rolling out a client portal for reorder + invoicing (net terms eligible).

-   Want me to send a sample flight + set your account up?

Corporate gifting

Subject: Executive gifting that actually lands

Body:

-   We do luxury food bundles (caviar flights, truffle kits) for client/exec gifting with branded inserts + scheduled delivery.

-   If I send 3 bundle options with pricing, who owns gifting/vendor selection?

## **3) Partnerships (fastest multiplier)**

Target partners who already sell to your ICP:

-   wine distributors

-   cheese/specialty food distributors

-   boutique meat suppliers

-   hotel procurement networks

-   chef influencer agencies

Partner model

-   Revenue share on first order + recurring

-   Co-branded bundles

-   Seasonal drop collaborations (their list + your list)

## **4) Paid ads (only after portal is real)**

-   Retargeting: site visitors + IG engagers

-   Lookalikes: A-accounts and repeat buyers

-   Search: "buy white truffles wholesale", "caviar supplier", "osetra caviar wholesale"

-   Lead gen: "Get the Chef Kit" gated to verified businesses

# **Bundles, upsells, and pricing strategy (turn 200 SKUs into predictable baskets)**

## **Bundle archetypes**

-   Chef Kit (entry)

-   Caviar Flight

-   Truffle Butter Trio

-   Holiday Hosting Pack

-   Corporate Gifting Pack

-   Hotel VIP Amenity Pack

## **Upsell rules (automate)**

-   If cart has truffles → upsell: truffle butter, truffle oil, finishing salt

-   If cart has caviar → upsell: blinis/creme fraiche equivalents, mother-of-pearl spoon, champagne pairing guide

-   If cart has salumi → upsell: cheese selection, crackers, pantry items

## **Account tiers (simple, enforceable)**

-   New account: prepaid + standard catalog

-   Repeat buyer: discounts + limited net terms

-   A account: best pricing + allocations + strongest terms

# **Dashboards & KPIs (what you track from day 1)**

## **CEO dashboard**

-   Revenue today / week / month

-   Gross margin by category

-   Orders shipped today + exceptions

-   Repeat rate (30/60/90 days)

-   Top accounts at churn risk (no order in 21+ days)

-   Rep leaderboard (margin-weighted)

## **Sales dashboard**

-   touches/connects/quotes/orders per rep

-   win rate by segment (restaurant vs hotel vs gifting)

-   AOV + reorder cadence

-   time to first order

## **Ops dashboard**

-   pick/pack time

-   shipping cost as % of order

-   late deliveries

-   refund/credit rate

-   inventory risk / OOS rate

# **The rollout roadmap (what happens when)**

## **Weeks 1--2: MVP + data foundation**

-   Normalize SKU master (units, minimums, case packs, flags)

-   MVP portal demo + 10 pilot accounts

-   Decide Shopify B2B catalog structure

## **Weeks 3--6: Shopify B2B go-live**

-   Company profiles + catalogs + quantity rules + payment terms

-   Shipping workflow + status updates

-   Klaviyo flows (abandoned cart, reorder, seasonal)

## **Weeks 7--16: Headless premium layer**

-   Rep-assisted ordering

-   allocations + market-rate history + smarter substitution

-   deep analytics + CRM sync + call scoring

-   partner portal + corporate gifting flows
