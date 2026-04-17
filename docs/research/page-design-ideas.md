Below is a screen-by-screen spec you can paste into your KB. It's written so a designer + engineer can implement without guessing: fields, components, states, buttons, permissions, and error handling for Buyer Portal + Rep Console + Ops + Admin/Finance.

## **Global UI system**

### **Top-level layout**

-   Left nav (role-aware): Dashboard, Catalog, Saved Carts, Orders, Invoices/Payments, Account

-   Top bar: Location selector (if multiple), Search, Notifications, Help, Profile

-   Global search: products + orders + invoices (scope toggles per role)

### **Global components**

-   Toast: success / error / warning

-   Inline alerts: market-rate, cutoff timer, credit hold, prepay required

-   Skeleton loaders: catalog lists, order lists, dashboards

-   Empty states: "No orders yet", "No saved carts", "No results"

-   Audit chip (internal): "Edited by X, 2h ago"

-   Status pill: Pending / Confirmed / Packed / Shipped / Delivered / Exception / Credit issued

### **Global states (every screen)**

-   loading / success / empty / error

-   offline (optional)

-   permission_denied (show "Contact your admin/rep")

### **Error handling standard**

-   Field-level validation (inline)

-   Form-level summary banner

-   Retry button on network failures

-   "Save draft" if multi-step entry fails (rep/admin screens)

# **BUYER PORTAL (Client-facing)**

## **1) Login**

Purpose: authenticate + route by role.

-   Inputs: Email, "Send magic link" / Password (if you use password)

-   Buttons: Send login link, Back

-   States:

    -   email_sent → "Check your email"

    -   invalid_email inline

    -   rate_limited → "Try again in 60 seconds"

    -   no_account → CTA: Request an account

## **2) Request an Account**

Purpose: capture B2B info and verify.

-   Fields:

    -   Business Name\*

    -   Website / IG handle (optional)

    -   Role\* (Chef / Purchasing / AP / Owner / Other)

    -   Full name\*

    -   Email\* / Phone\*

    -   Address / City / State / Zip\*

    -   Estimated weekly spend (range)

    -   Interested categories (multi-select)

    -   Upload resale cert (optional)

-   Buttons: Submit, Save and finish later

-   States:

    -   submitted → "We'll review shortly"

    -   needs_more_info → email triggered

    -   rejected → show reason + "Contact sales"

-   Errors:

    -   duplicate email/business → "Already exists --- request access"

    -   missing required fields

## **3) Buyer Dashboard**

Widgets (top row)

-   Reorder Last Order (big CTA)

-   Saved Carts (count + quick open)

-   Delivery status (in-flight shipments)

-   Payment status (invoices due/overdue; if net terms)

Sections

-   "Recommended for you" (upsells based on last order)

-   Seasonal drop banner (if active)

-   Notifications (substitutions awaiting approval, cutoff warnings)

Buttons

-   Reorder, View saved carts, Browse catalog, Pay invoice

States

-   New account (no orders): show "Start your first order" guide + 3 starter bundles

-   Dormant account: show "We rebuilt your last cart" + quick reorder CTA

## **4) Location Selector Modal (if multiple ship-tos)**

-   List of locations with tags:

    -   Terms (Prepay / Net 15 / Net 30)

    -   Delivery method (Local / Ship)

    -   Free-delivery eligibility (zone)

-   Actions: Select location, Manage locations (Owner only)

## **5) Catalog Home**

Primary controls

-   Search bar (supports "30g", "A5", "osetra")

-   Filters:

    -   Category

    -   Market-rate

    -   Seasonal

    -   Allocation-only

    -   Available now (if inventory connected)

    -   Case-only (if visible)

-   Sort:

    -   Recommended

    -   Popular

    -   Price (low/high)

    -   New/Seasonal

Cards show

-   Product name + pack size

-   Price (or "Market" / "Request price")

-   Min qty + increment badges

-   Cold-chain badge

-   "Prepay required" badge

-   "Cutoff timer" badge (if relevant)

Buttons

-   Add to cart (or Request allocation / Request quote)

-   Favorite

States

-   No results: show query suggestions + "Clear filters"

-   Market items: show a sticky disclaimer banner

## **6) Product Detail Page**

Sections

-   Title + pack sizes (variants)

-   Pricing display rules:

    -   Fixed price → show price

    -   Market-rate → show current price + "subject to change" disclaimer + last updated time

    -   CS-only → hide price or show "Contact rep"

-   Quantity selector enforces:

    -   min qty

    -   increment steps

    -   max (optional)

-   "Delivery & handling"

    -   SLA (24--48 hr if applicable)

    -   cutoff time (countdown)

    -   cold chain note

-   "Storage & serving" (chef-friendly)

-   "Related items" (upsell mapping)

Buttons

-   Add to cart

-   Add to saved cart

-   Request quote (for restricted/large orders)

-   Message rep (opens contact modal)

Error states

-   Out of stock → show "Notify me" (optional) + substitution suggestions

-   Invalid qty → inline correction + snap to valid increment

-   Terms conflict (prepay item on net terms) → prompt "Split order" flow

## **7) Cart**

Line item UI

-   Variant, pack size

-   Qty stepper (min/increment)

-   Notes (optional: "thin slice", "for event Friday")

-   Availability indicator

-   Remove

Cart summary

-   Subtotal

-   Delivery fee estimator (zone + threshold messaging)

-   Taxes (if applicable)

-   Payment method / Terms preview

-   Cutoff warnings (if any line item has cutoff)

Buttons

-   Checkout

-   Save as cart

-   Send to AP for approval (if approvals enabled)

-   Clear cart

States

-   Mixed rules:

    -   If cart includes prepay-required + terms items → show Split Order wizard:

        -   Order A (prepay items)

        -   Order B (terms eligible)

    -   If cart includes CS-only items → show "Rep approval required" and convert to quote request

## **8) Checkout**

Step 1: Delivery

-   Ship-to address (from location)

-   Delivery method: Local delivery / Ship

-   Delivery date selector (if local routes)

-   Special instructions

Step 2: Payment

-   If prepay: card/ACH/wire instructions (your choice)

-   If net terms: show terms and due date; allow "Pay now" button

-   Deposits: show deposit amount and remainder due

Step 3: Review

-   Order totals

-   Terms acknowledgement checkbox

-   Market-rate acknowledgement checkbox (required)

-   Substitution policy acknowledgement checkbox (optional)

Buttons

-   Place order

-   Back

-   Save draft (optional)

Error handling

-   Payment failed → retry + alternate method

-   Terms not allowed → "Contact finance" + rep ping

-   Cutoff missed → offer next available delivery + "still place order?" prompt

## **9) Orders List**

-   Filters: status, date range, location, category

-   Search: order number / item / PO

-   List row: Order #, date, total, status pill, "Pay now" if due

Buttons

-   View

-   Reorder

-   Download invoice / Pay now

States

-   Empty → show "Browse catalog" + "Start with bundles"

## **10) Order Detail**

Timeline

-   Received → Confirmed → Packed → Shipped → Delivered

-   Tracking link (if shipped)

-   Delivery window (if local)

Line items

-   Qty, price, substitutions (if any)

-   Notes

Financial

-   Payment status

-   If terms: due date + remaining balance + pay button

-   Credits applied / available credit

Actions

-   Reorder

-   Report an issue

-   Download invoice

-   Approve substitution (if pending)

## **11) Substitution Approval (Modal + dedicated screen)**

-   Shows:

    -   Original item + price

    -   Proposed substitute + price delta

    -   Reason (OOS, quality, season change)

    -   Time limit for approval

-   Buttons: Approve, Reject, Call rep

States

-   expired → auto route to rep

-   rejected → prompts alternate suggestions

## **12) Saved Carts**

-   List: name, last updated, item count, estimated total

-   Actions: Open, Rename, Duplicate, Delete, Checkout

Empty state

-   "Create saved carts for weekly ordering" + "Save current cart" CTA

## **13) Invoices / Payments (if net terms)**

-   Tabs: Due, Paid, Overdue

-   Each invoice: amount, due date, related order, pay now

-   Payment methods management (Owner/AP only)

Errors

-   Pay attempt fails → show reason + alternate instructions

## **14) Account Settings**

Owner-only

-   Team users (invite, role assignment)

-   Locations (add/edit shipping address)

-   Preferences (delivery days, contact preferences)

Buyer/AP

-   Notification settings

-   Default payment method (AP)

# **REP CONSOLE (Internal)**

## **15) Rep Dashboard**

Widgets

-   Pipeline summary (new leads, quotes out, orders won, dormant)

-   Tasks due today

-   Top accounts at risk (no order in 14/30/60)

Lists

-   Abandoned carts

-   Pending approvals (substitutions/quotes)

-   VIP allocation requests

Buttons

-   Create quote

-   Build order for account

-   Log call

-   Send reorder link

## **16) Rep Account List**

-   Columns: Account, Location, Tier, Last order date, 30d spend, Status (Active/Dormant), Owner rep

-   Filters: tier, city, segment, dormant window, "has open cart"

-   Bulk actions: assign sequence, add task, tag segment

## **17) Rep Account Detail**

Header

-   Account name, tier, terms, credit hold flag, rep owner

-   Quick actions: Build cart, Create quote, Send reorder link, Add note, Add task

Tabs

-   Overview (KPIs + preferences)

-   Orders (history + reorder)

-   Open carts (saved/abandoned)

-   Notes & preferences (chef favorites, delivery constraints)

-   Contacts (chef/AP/owner)

-   Activity (calls, emails, tasks)

## **18) Build Cart for Client (Rep-assisted order)**

-   Choose location

-   Add items (search + quick add)

-   Quantity rules enforced

-   Add internal notes ("VIP, rush")

-   Choose output: Send as quote OR Submit order OR Send approval link

States

-   If CS-only items included → auto sets "requires admin approval"

-   If prepay items in terms account → prompts split order

## **19) Quote Builder**

-   Line items, discounts (guardrails), shipping, taxes

-   Terms: prepay vs net terms

-   Expiration date

-   Buttons: Send quote, Send pay link, Convert to order, Save draft

Error handling

-   discount exceeds max margin threshold → block + manager approval required

## **20) Tasks / Sequences**

-   Task types: Call, Email, SMS, Follow-up, "Send kit"

-   Due dates + reminders

-   Sequence enrollments (e.g., winback 3-step)

# **OPS CONSOLE (Fulfillment + delivery)**

## **21) Ops Dashboard**

Widgets

-   Orders to pack today

-   Orders due by cutoff

-   Exceptions queue (substitution needed, address issues, payment hold)

-   On-time % and exceptions count

## **22) Pick/Pack Queue**

-   Filters: ship method, warehouse, priority, cutoff window

-   Each order card:

    -   items count

    -   cold-chain badge

    -   "rush" flag

-   Actions: Start packing, Print pick list, Mark packed

## **23) Packing Screen**

-   Pick list grouped by category (caviar/truffles/proteins)

-   Packing checklist:

    -   insulation type

    -   gel pack count

    -   temp indicator (optional)

    -   label verification

-   Buttons: Generate label, Mark packed, Flag exception

Error handling

-   label generation fails → retry + "manual label" entry

## **24) Shipping & Tracking**

-   Batch label creation

-   Tracking numbers displayed + pushed back to order

-   Buttons: Mark shipped, Resend tracking email

## **25) Substitution Queue (Ops → Buyer approval)**

-   List of line items needing substitution

-   Proposed alternatives dropdown (from substitution mapping)

-   Price delta input + reason

-   Buttons: Send for approval, Escalate to rep

## **26) Local Delivery Routes**

-   Route list by day

-   Stop sequence with addresses + contact notes

-   Proof-of-delivery capture (optional)

-   Buttons: Export route, Mark delivered, Report issue

# **ADMIN / FINANCE (Control center)**

## **27) Admin Dashboard**

-   New account requests

-   Orders on hold

-   Catalog change alerts

-   Payment due/overdue summary

-   Inventory warnings (if integrated)

## **28) Account Requests Review**

-   Applicant details + verification checklist

-   Assign:

    -   Rep owner

    -   Tier/catalog

    -   Terms + deposit policy

-   Buttons: Approve, Request info, Reject

## **29) Companies & Locations Admin**

-   Company profile

-   Locations list

-   Terms per location

-   Credit hold toggle

-   Notes (internal)

Bulk actions

-   bulk tier assignment

-   bulk terms assignment

## **30) Catalog / Tier Manager**

This maps to Shopify B2B catalogs.

-   Create catalogs: New / Repeat / VIP / Segment-specific

-   Assign products to catalogs

-   Set pricing rules per catalog

-   Configure quantity rules + volume pricing (min/increment/breaks)

Guardrails

-   Detect conflicting catalog pricing

-   Warn when a company location has too many catalogs assigned

## **31) Payment Terms & Deposits Admin**

-   Terms templates (Net 15/30/45/60, due on fulfillment)

-   Deposit rules by:

    -   tier

    -   category

    -   order size

-   Collections queue:

    -   overdue invoices

    -   payment promises logged

## **32) Refunds / Credits / Adjustments**

-   Create credit tied to order

-   Apply credit to next order

-   Reason codes + audit trail

-   Buttons: Issue credit, Refund, Reship

## **33) Analytics**

-   Revenue + margin by category

-   Reorder cohort charts

-   Rep leaderboard (margin-weighted)

-   Ops SLA + on-time metrics

-   "Churn risk" accounts list

# **Implementation expansion (how to adapt to "you already have a lot built")**

## **Fast alignment method**

1.  Inventory what's built per screen:

-   Marketing pages

-   Portal login

-   Catalog UI

-   Cart/checkout

-   Orders view

-   Admin tools

2.  Map each built screen to the spec above:

-   Keep what matches

-   Add missing "B2B reality" constraints:

    -   min/increment enforcement

    -   prepay gates

    -   CS-only items flow

    -   split-order wizard

    -   substitution approvals

    -   rep-assisted ordering

3.  Add the "ops spine" (the part most MVPs miss)

-   packing workflow + label generation + exceptions queue

-   invoice/terms visibility

-   audit logging
