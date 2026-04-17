## **Expanded PRD v1.0 for TBGC (Marketing + B2B Portal + Sales + Ops)**

This PRD assumes Track 2 (Shopify B2B core) is the system of record, with a later headless portal layer.

### **0) Product goals and success metrics**

Primary goals

-   Self-serve ordering + reorder for verified accounts

-   Remove CEO as bottleneck for: pricing, ordering, payment chasing, and status updates

-   Make sales measurable (22 reps) and ops observable (fulfillment + margins)

North-star metrics

-   \% orders placed via portal (target: 70%+ by day 90)

-   Reorder rate (30/60/90 day cohorts)

-   Average order value (AOV) and gross margin by category

-   Sales: touches → connects → quotes → first orders conversion, by rep

-   Ops: on-time delivery %, exception rate, refund/credit rate

## **1) Personas and permissions (RBAC)**

Buyer side

1.  Chef / Purchaser -- builds carts, reorders, requests quotes

2.  AP / Accounting -- pays invoices, manages payment methods, sees terms

3.  Owner / GM -- manages users, approves big orders, sees spend

Internal

4\) Sales Rep -- owns accounts, builds orders on behalf, sends quotes, follow-ups

5\) Ops/Fulfillment -- pick/pack/ship, substitutions, delivery scheduling

6\) Admin/Finance -- catalogs/tiers, terms, credit holds, refunds/credits, reporting

7\) CEO -- dashboards + approvals + escalations only

Permission model (minimum)

-   Company roles: Owner, Buyer, AP

-   Internal roles: Rep, Ops, Admin, Finance, Super Admin

-   Every action writes an audit log (who changed price/tier/terms/order status and when)

## **2) Information architecture (screens)**

### **Public marketing site**

-   Home

-   Products (category landing pages)

-   Seasonal drops (White truffle / holiday caviar / event bundles)

-   "Request an account" + "Login"

-   Trust pages: shipping/cold chain, sourcing/provenance, FAQ

### **B2B portal**

-   Dashboard (last order, reorder, saved carts, rep contact)

-   Catalog browsing + search + filters

-   Product detail (pack sizes, min/increment, storage, provenance)

-   Cart + checkout (terms/deposit, shipping logic, delivery scheduling)

-   Orders (status timeline + invoices + pay-now)

-   Account settings (team users, locations, payment methods, terms)

### **Rep console**

-   Account list (filters: dormant, high value, open quote, abandoned cart)

-   Account detail (notes, preferences, last order, suggested upsell)

-   "Build cart for client" + "Send approve/pay link"

-   Tasks + sequences (follow-ups, wins/losses)

### **Ops console**

-   Pick/pack queue

-   Packing checklists (cold chain rules)

-   Shipping labels + tracking numbers

-   Substitution workflow + customer approval

-   Delivery routes (local truck days) + cutoff timers

### **Admin/Finance**

-   Companies + locations + tiers

-   Catalogs + pricing rules + quantity rules

-   Payment terms + deposits + credit holds

-   Refunds/credits + exceptions

-   Analytics dashboards

## **3) Product data model (what must exist)**

### **Core objects**

-   Company

-   Location (ship-to + billing rules; terms assigned here in Shopify B2B)

-   User (role + location permissions)

-   Catalog / Tier (product access + pricing rules)

-   Product / Variant

-   Order (+ line items, fulfillment events)

-   Payment term (net 7/15/30/45/60/90, due on fulfillment, deposit %, etc.)

-   Price record (market-rate history, if you track)

-   Allocation (optional, but high leverage for white truffles / rare items)

-   Substitution mapping

-   Audit log

### **Required product flags (TBGC-specific)**

-   market_rate (show disclaimer + confirmation flow)

-   prepay_required (hard gate)

-   case_only / CS_only (don't allow self-serve checkout, or require rep/admin approval)

-   min_qty + increment

-   cold_chain_required

-   sla_hours

-   cutoff_time

## **4) Functional requirements by epic (deep)**

### **Epic A --- B2B onboarding + verification**

User flows

-   Request account → verify business → approve → assign rep → assign tier/catalog → enable login

-   "Invite teammate" (chef invites AP, owner invites staff)

Acceptance criteria

-   Account request captures: business name, EIN/Resale cert optional, location(s), role, estimated weekly volume, categories

-   Admin can approve in \<2 minutes:

    -   Assign catalog tier(s) (max 25 per location in Shopify)

    -   Assign payment terms and optional deposit %

-   Rejected applicants get a polite email + "contact sales" path

Edge cases

-   One company with multiple locations + different terms per location

-   "Buyer wants net terms" → route to Finance approval queue

### **Epic B --- Catalog + search (200+ SKUs, fast)**

Features

-   Search: synonyms + pack sizes (30g, 60g, 125g, 500g)

-   Filters: category, market-rate, seasonal, allocation-only, case-only

-   Product detail:

    -   "What you get" (pack size)

    -   min/increment

    -   storage/handling

    -   lead time / SLA

    -   provenance assets (optional COA PDFs)

Acceptance criteria

-   Quantity rules + volume pricing visible and enforced (via catalog rules)

-   Market-rate items show "price subject to change" and require click-through acknowledgment

-   Allocation-only items show "request allocation" instead of "add to cart"

Edge cases

-   Same product exists in two catalogs: Shopify displays lowest price rules depending on assignment logic; design for it (avoid conflicting catalogs where possible)

### **Epic C --- Cart + checkout + terms/deposits + approval**

Features

-   Saved carts (Weekly Par, VIP Event)

-   Reorder last order (1-click)

-   Optional approval flow:

    -   Chef builds cart → Owner/AP approves → submit

-   Payment terms (B2B):

    -   net terms

    -   due on fulfillment

    -   deposits (percentage up-front)

Acceptance criteria

-   Customers can "Pay now" during term window; overdue state visible

-   Prepay-required products cannot be checked out on net terms (rule)

-   Deposit % applies correctly and shows in checkout + order view

Edge cases

-   Mixed carts (some items prepay-only): enforce "split order" (recommended) or block

-   Manual payments (wire/check): must create "payment pending" state and internal follow-up tasks

### **Epic D --- Orders + fulfillment + substitutions + cold chain**

Features

-   Order status timeline

-   Pick/pack list generation

-   Shipping label creation and tracking injection

-   Substitution workflow:

    1.  Ops proposes substitution (reason + price delta)

    2.  Buyer approves in portal (or rep approves on call)

    3.  Updated order confirmation sent automatically

Acceptance criteria

-   Cutoff timers displayed for categories (truffles/fish)

-   Exceptions create internal tickets + buyer notifications

-   Refund/credit flows linked to an order and appear in account history

Edge cases

-   Partial fulfillment / split shipments

-   Temperature incident claim: capture evidence + resolution type (refund/credit/reship)

### **Epic E --- Rep console (make 22 reps elite)**

Features

-   Work queue: abandoned carts, open quotes, dormant accounts, high-LTV alerts

-   "Build cart for client" with audit log

-   Quote/invoice links

-   Notes, preferences, upsell prompts

Acceptance criteria

-   Rep can trigger a "reorder link" and send via SMS/email

-   Every rep action logged and attributable

-   Rep dashboards: margin-weighted leaderboard + conversion funnel

### **Epic F --- Admin/Finance control center**

Features

-   Catalog/tier management (pricing, access, quantity rules)

-   Payment terms assignment in bulk (companies page bulk edit in Shopify)

-   Credit holds / review-required orders

-   Deposit rules and "submit order for review" mode (draft order flow)

Acceptance criteria

-   Changes to tiers/terms require role permission + audit log

-   Finance can filter orders due/overdue (Shopify supports "Due" views conceptually)

## **5) Non-functional requirements (this is where "professional & clean" becomes real)**

-   Performance: catalog search returns in \<500ms (cached + indexed)

-   Reliability: webhooks retried; idempotent order ingestion

-   Security: 2FA for internal users; least-privilege; PII encryption-at-rest where applicable

-   Compliance: clear data retention; role-based access; audit trails

-   Observability: logs, metrics, alerting for failed payments/webhooks/shipping label errors

# **Expanded Implementation Plan (Shopify B2B core + integrations + rollout)**

This is "do it in order, nothing breaks."

## **Phase 0 --- Decisions you lock in (1--2 days)**

1.  Store strategy

-   One store for B2B + possible DTC later, or separate B2B store (Shopify supports either approach)

2.  Plan requirement

-   Shopify B2B is Shopify Plus-only

3.  Catalog strategy

-   Decide your tiers and avoid overlapping catalog conflicts (because lowest-price rules can surprise you)

4.  Payment policy

-   Which tiers get net terms

-   Deposit % for high-risk carts (Shopify supports deposits on terms)

## **Phase 1 --- Data foundation + SKU master (week 1)**

Deliverables

-   SKU master v1

-   Category taxonomy (no more "misc")

-   Rules encoded as fields (market/prepay/case-only/min/increment)

Implementation notes

-   Treat "CS-only" items as either:

    -   hidden from self-serve catalogs, or

    -   visible but "request quote / rep-assisted only"

QA checklist

-   Every SKU has: uom, pack_size, category, min/increment, and at least one pricing field

-   Test: "prepay-required" items fail checkout on terms

## **Phase 2 --- Shopify B2B setup (week 2--3)**

### **Step A: Enable B2B and model customers as Companies**

-   Create Companies and Company Locations in Shopify

-   Assign users to companies and locations

-   Configure customer accounts login experience

### **Step B: Create catalogs and assign to locations**

-   Build catalogs by tier/segment

-   Assign catalogs to company locations (up to 25 per location)

-   Ensure "no conflicting duplicate product pricing" across multiple catalogs unless deliberate

### **Step C: Quantity rules + volume pricing**

-   Apply min/increment rules and volume breaks in the catalog layer

### **Step D: Payment terms + deposits**

-   Set terms per company location (net 7--90, due on fulfillment)

-   Add deposit % where required (supported for B2B terms)

-   Bulk-edit payment terms for multiple companies when onboarding waves

### **Step E: Draft orders workflow (rep-assisted / reviewed orders)**

-   Train reps/admins on creating draft orders and sending invoices

-   Use deposits on draft orders when you want partial upfront payment

QA checklist

-   Test 3 companies across tiers:

    -   New account (prepay only)

    -   Repeat (net 15 + no deposit)

    -   VIP (net 30 + 20% deposit)

-   Test mixed carts and ensure you have a policy (split vs block)

## **Phase 3 --- Fulfillment + shipping + status automation (week 3--4)**

Integrations

-   Shipping labels: choose one (ShipStation or Shippo)

-   Tracking numbers pushed back into Shopify

-   Local delivery rules (zone-based)

-   Packing checklists in Ops console (even if it's a lightweight internal web page at first)

Ops automation

-   Webhook: order created → route to fulfillment queue

-   SLA/cutoff rules: show on product and in cart

-   Exception triggers: OOS, substitution required → notify rep + buyer

## **Phase 4 --- CRM + call recording + revenue operations (week 4--6)**

### **CRM selection**

Pick one:

-   HubSpot (best dashboards + ops maturity)

-   Pipedrive (fastest rep adoption)

### **Call recording / coaching**

Pick one system of record:

-   Gong (deep coaching + analytics)

Data flows

-   Shopify company/location ↔ CRM account/contact sync

-   Orders → CRM (last order date, spend, category mix)

-   Calls → CRM notes/tasks automatically

Rep scorecard (minimum)

-   touches/day, connects/day, quotes/day, orders/week

-   reorder reactivation count

-   margin-weighted sales (don't reward discounting)

## **Phase 5 --- Headless layer (optional, 6--16 weeks, once stable)**

When you do this

-   After Shopify B2B is stable and reps are using the system daily

Stack

-   Next.js + Tailwind CSS + your component library

-   Supabase for custom objects (allocations, market-rate history, rep console features)

-   UI acceleration: Vercel v0 via its API for components/workflows

# **Rollout plan (how you avoid chaos)**

Wave 1 (10--25 accounts): your best relationships + highest reorder likelihood

-   Goal: validate catalog rules, terms, fulfillment, and "reorder UX"

Wave 2 (50--100 accounts): add reps and enforce "portal-first" ordering

-   Goal: rep console adoption + measurable KPIs

Wave 3 (all accounts): enforce policy

-   "CS-only" items: rep-assisted only

-   Payment policy: net terms only for tiers that earned it

# **Testing plan (do not skip)**

Catalog & pricing

-   Catalog assignment logic (lowest price / most specific rules)

-   Quantity rules + volume breaks show correctly

Payments

-   Net terms behavior and overdue behavior

-   Deposits: percent of subtotal; invoice behavior for draft orders

Order review

-   Draft order workflow for "submit for review" mode

Ops

-   Shipping label + tracking updates

-   Substitution approval loop
