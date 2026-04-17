Below are the four KB-ready artifacts you asked for, fully expanded:

1.  SKU Master CSV (headers + example rows + rule logic)

2.  Portal PRD v1 (epics → user stories → acceptance criteria)

3.  Sales Ops Playbook (pipeline, scripts, winback, bundles, coaching)

4.  Implementation checklist (Shopify B2B setup + migration map + integrations)

# **1) SKU Master CSV Pack (Headers + Example Rows + Rule Logic)**

## **1.1 CSV headers (copy/paste)**

sku_id,display_name,category,sub_category,status,uom,pack_size,case_pack_qty,sold_by,min_order_qty,order_increment,max_order_qty,price_model,base_price,market_price_low,market_price_high,catalog_visibility,restricted_flag,prepay_required,net_terms_eligible,deposit_required_pct,origin,season_start,season_end,sla_hours,cold_chain_required,cutoff_time_local,fulfillment_type,warehouse,delivery_zone_rule,free_delivery_threshold,under_threshold_fee,price_disclaimer,handling_notes,storage_notes,coa_available,substitution_skus,tags

### **Field notes (what actually matters for TBGC)**

-   min_order_qty + order_increment is mandatory for truffles (4 oz / 5 oz / 8 oz minimums)

-   prepay_required is mandatory for items like White Abruzzese ("must be pre-paid before ordering")

-   restricted_flag is mandatory for "SOLD BY THE CS ONLY" case-only inventory

-   price_disclaimer is mandatory for volatile categories like fish ("price changes daily/weekly... subject to change")

-   delivery_zone_rule + thresholds are mandatory for LA/OC rules (free delivery \$300 min within 40 miles; otherwise \$40 fee)

-   sla_hours is mandatory for fresh truffles ("delivery is typically 24--48hrs")

## **1.2 Example rows (seed set you can import immediately)**

TBGC-TRUF-SUMMER-AESTIVUM,Summer Black Truffles (Tuber Aestivum),Truffles,Fresh Truffles,seasonal,oz,1 oz,,\"unit\",4,1,,market,,50,60,default,,false,true,,Abruzzo Italy,2025-04-01,2025-08-31,48,true,14:00,warehouse_ship,LA-DC,LAOC_WITHIN_40MI,300,40,\"All prices subject to change\",\"Handle gently; avoid moisture\",\"Refrigerate; wrap in paper towel; airtight container\",false,,truffles;fresh;seasonal

TBGC-TRUF-AUTUMN-UNCINATUM,Autumn Black Truffles (Burgundy) (Tuber Uncinatum),Truffles,Fresh Truffles,seasonal,oz,1 oz,,\"unit\",5,1,,market,,100,125,default,,false,true,,Abruzzo Italy,2025-09-01,2025-12-10,48,true,14:00,warehouse_ship,LA-DC,LAOC_WITHIN_40MI,300,40,\"All prices subject to change\",\"Handle gently; avoid moisture\",\"Refrigerate; wrap in paper towel; airtight container\",false,,truffles;fresh;seasonal

TBGC-TRUF-WHITE-MAGNATUM,White Abruzzese Truffle (Tuber Magnatum Pico),Truffles,Fresh Truffles,allocation_only,oz,1 oz,,\"unit\",8,1,,market,,200,,vip,,true,false,,Abruzzo Italy,2025-09-20,2025-12-15,48,true,14:00,warehouse_ship,LA-DC,LAOC_WITHIN_40MI,300,40,\"All prices subject to change\",\"Prepay required; allocation-limited\",\"Refrigerate; wrap in paper towel; airtight container\",false,,truffles;white;allocation

TBGC-FISH-MARKET-RULE,Market Fish (Sashimi Grade),Fish,Japanese Fish,seasonal,lb,1 lb,,,1,1,,market,,,,vip,,false,true,,Varies,,,24,true,12:00,warehouse_ship,LA-DC,LAOC_WITHIN_40MI,300,40,\"Price changes daily/weekly; subject to change\",\"Confirm availability; substitution may be required\",\"Refrigerate immediately; keep cold chain\",false,,fish;market

TBGC-DUCK-RILLETTES-CS,Duck Rillettes (8oz) - Case,Proteins,Duck,active,ea,8oz,6,case,1,1,,fixed,9.81,,,default,\"SOLD_BY_CS_ONLY\",false,true,,France,,,72,true,14:00,warehouse_ship,LA-DC,STANDARD_SHIP,,,,,\"Keep chilled\",\"Refrigerate\",false,,duck;case_only

Where the values come from (your distribution list)

-   Truffle minimums + SLA: Summer 4 oz min; Autumn 5 oz min; White 8 oz min + prepay; "delivery is typically 24--48hrs"

-   Fish volatility + delivery fee rule: "price changes daily/weekly... subject to change"; free delivery \$300 min within 40 miles; under minimum \$40 fee

-   Case-only language appears in the list (example row uses case-only pattern)

## **1.3 Rule objects (so the portal can enforce constraints automatically)**

### **A) Delivery pricing rule (LA/OC)**

-   Condition: distance_miles \<= 40

-   If order_subtotal \>= 300 → delivery fee = 0

-   Else → delivery fee = 40

### **B) Market-rate disclaimer rule (Fish + certain truffles)**

-   Show banner when price_model == \"market\": "price changes daily/weekly... subject to change"

### **C) Prepay gate rule (White truffle)**

-   If prepay_required == true → only allow checkout if payment method is immediate capture (no terms)

-   Source: "must be pre-paid before ordering"

# **2) Portal PRD v1 (Epic pack)**

## **2.0 Product goals**

-   Replace phone-based ordering with verified B2B portal

-   Enforce minimums, increments, case-only items, prepay gates

-   Give clients reorder in seconds

-   Give reps a reactivation + upsell console

-   Give CEO dashboards + visibility without being the bottleneck

## **Epic A --- B2B account request + approval + tier assignment**

### **User stories**

-   As a buyer, I can request access using business info.

-   As admin, I can approve and assign:

    -   catalog tier (New / Repeat / VIP)

    -   payment rule (prepay-only vs terms)

    -   rep owner

-   As buyer, I can invite teammates (chef/AP).

### **Acceptance criteria**

-   Account request collects: business name, address, role, phone, email, ordering volume, categories.

-   On approval, system sets:

    -   a catalog and terms per location (see Shopify implementation in section 4)

## **Epic B --- Catalog (200+ SKUs) with "B2B reality" controls**

### **Must-have features**

-   Search (name, origin, "A5", "Osetra", "Uni", etc.)

-   Filters: category, seasonal, market-rate, allocation-only

-   SKU detail:

    -   min order + increment

    -   storage/handling notes

    -   lead time/SLA

### **Acceptance criteria**

-   For truffles, enforce min order + show SLA:

    -   "delivery is typically 24--48hrs"

    -   Summer 4 oz min

    -   Burgundy 5 oz 6-L17

    -   White 8 oz 31-L33

## **Epic C** 

## **logic (prepay, terms,** 

## **ved carts**

-   Reorder last order

-   Shipping fee logic (local delivery vs ship)

-   Payment methods:

    -   immediate pay

    -   net terms / due on fulfillment

    -   optional deposits

### **Acceptance criteria (Shopify B2B-aligned)**

-   Payment terms per company location; include net periods, due on fulfillment, fixed date, and optional deposits

-   Quantity rules (increments/min/max) + volume pricing are enforceable via catalogs and CSV import

## **Epic D --- Orders + fulfillment workflow**

### **Must-haves**

-   Statuses: received → confirmed → packed → shipped/delivered → closed

-   Exception handling:

    -   substitution request

    -   delayed shipment

    -   credit issued

### **Acceptance criteria**

-   Market-rate categories display disclaimer: "price changes daily/weekly... subject to change"

-   Delivery fee rule applied (LA/OC): free delivery threshold and \$40 fee under minimum

## **Epic E --- Rep console (22 reps become measurable)**

### **Must-haves**

-   "Accounts to reactivate" list (7/14/30/60 day no-order)

-   Op ote → accept → order link

-   Build cart on behalf of client

### **Acceptance criteria**

-   Rep ild cart (with audit trail)

-   Rep gets automatic tasks from triggers:

    -   abandoned cart

    -   quote pending 24h

    -   no reorder in X days

## **Epic F --- Dashboards (CEO off phone)**

### **Must-haves**

-   Revenue (today/week/month)

-   Margin by category

-   Churn risk list

-   Rep leaderboard (margin-weighted)

-   Ops KPIs: on-time %, exception rate

# **3) Sales Ops Playbook (Pipeline, scripts, winback, bundles, coaching)**

## **3.1 Pipeline (B2B distribution reality)**

Stages:

1.  Inbound / Outbound Lead

2.  Qualified (role verified)

3.  Offer sent (Chef Kit / Caviar Flight / Quote)

4.  First order placed

5.  Repeat buyer

6.  VIP / A Account (terms + allocations)

7.  Dormant / Winback

Definition of "Qualified"

-   Chef / purchasing / AP identified

-   Business verified

-   Use-case confirmed (menu needs, event calendar, weekly volume)

## **3.2 Offer ladder (you sell "easy repeatability")**

### **Offer 1 --- Chef Kit (intro)**

-   Purpose: convert interest → first transaction

-   Delivery: portal order only

-   Rule: credit applied to next order, limit 1 per company

### **Offer 2 --- Caviar Flight (3× 30g)**

-   Purpose: upsell + tasting program

-   Add-on: pairing guide + reorder QR

### **Offer 3 --- Seasonal allocation list (white truffles)**

-   Purpose: scarcity + VIP funnel

-   Rule: prepay gate required

### **Offer 4 --- Standing order / par levels**

-   Purpose: predictable revenue + ops smoothing

-   Mechanic: saved cart + scheduled reminders (not auto-ship at first)

## **3.3 Upsell triggers (automated rules)**

-   If cart contains truffles → upsell truffl oils

-   If cart contains caviar → upsell accessories + bundle pack

-   If cart contains fish → upsell "omakase box" type bundles + add delivery threshold prompt (hit \$300 for free delivery)

## **3.4 Scripts (phone + email)**

### **"Portal-first" script (rep on phone)**

-   "I'll set you up with a login so you can reorder anytime."

-   "For fresh truffles we deliver typically 24--48 hours."

-   "Summer truffles are a 4 ; white truffles are 8 oz and prepay."

### **Winback text (7--14 days after last order)**

-   "Quick check --- want me and send a 1-click reorder link?"

### **Market-rate disclaimer line (fish/truffles)**

-   "This categor c m turn6file2L22-L24

## **3.5 Coaching & call tracking (what to instrument)**

Use a single system for recording + scoring + summaries.

What you score:

-   talk ratio

-   offer delivered (chef kit/flight/standing order)

-   objection handling (price, timing, availability)

-   follo lementation Checklist (Shopify B2B + migration map + integrations)

## **4.1 Shopify B2B setup (source-of-truth core)**

### **Step 0 --- Plan requirement check**

Shopify B2B functionality referenced here is documented as available on Shopify Plus.

### **Step 1 --- Data foundation**

-   Create SKU master v1 (CSV)

-   Standardize:

    -   units (oz/lb/g/ea)

    -   minimums + increments

    -   prepay flags

    -   market price flags

    -   restricted flags

### **Step 2 --- Company accounts model**

In Shopify B2B:

-   Set up Companies and Company Locations

-   Attach payment terms per location (Net 7/15/30/45/60/90, due on fulfillment, fixed date, deposit %)

### **Step 3 --- Catalogs (pricing + product access)**

-   Create catalogs:

    -   NEW (prepay only)

    -   REPEAT (better pricing, limited terms)

    -   VIP (best pricing, allocations)

-   Use quantity rules + volume pricing via catalogs or CSV import

### **Step 4 --- Quantity rules (the "min order" enforcement)**

-   Set increment/minimum rules per variant via catalogs

-   Map your real constraints:

    -   Summer truffles min 4 oz

    -   Burgundy min 5 oz

    -   White min 8 oz + prepay

### **Step 5 --- Payment terms + deposits**

-   Configure per company location:

    -   Net terms options + deposits for risk items

-   For prepay-required SKUs:

    -   keep those in a catalog that only allows immediate payment

    -   or enforce via checkout rules in headless layer later

### **Step 6 --- Theme/UX surfacing (if not headless)**

-   Ensure your theme displays quantity rules/volume pricing (Shopify provides guidance)

## **ne chaos → clean system)**

today

-   phone notes + texts

-   I s + pricing + orders)

-   PayPal/Zelle/CashApp/Stripe receipts

-   tribal knowledge ("ask CEO")

### **Target system objects**

A\) Companies

-   Company name

-   Primary contact

-   Billing contact (AP)

-   Locations (ship-to addresses)

-   Assigned rep

-   Catalog tier

-   Payment terms

B\) Products

-   SKU master (above)

-   Pricing per catalog

-   Quantity rules + volume pricing

-   Market price categories flagged

C\) Orders

-   Order history (even partial imports help)

-   Last order date (for winback automation)

-   Average order value

### **Migration workflow (fast and safe)**

1.  Import Companies + Locations

2.  Import Products

3.  Assign catalog tiers

4.  Import "last order date" if possible (even a rough export)

5.  Turn on portal for top 25 accounts first (pilot)

6.  Scale to all accounts once ops is stable

## **4.3 Integrations (recommended "minimum viable stack")**

### **Commerce core**

-   Shopify for B2B accounts, catalogs, terms, ordering

### **Email & lifecycle**

-   Klaviyo:

    -   welcome sequence

    -   abandoned cart

    -   reorder reminders

    -   seasonal drops

    -   winback

### **CRM**

-   HubSpot (or Pipedrive) for rep ownership + pipeline

### **Shipping**

-   ShipStation or Shippo for labels + rate shopping

### **Accounting**

-   QuickBooks for books and reconciliation

### **Premium portal build (when ready)**

-   Supabase for custom ops objects (allocations, rep tools, etc.)

-   Vercel v0 for rapid UI generation and handoff to Next.js
