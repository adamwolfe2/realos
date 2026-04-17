# TBGC - Idea Triage

## Rubric

| Criteria | Weight | Description |
|----------|--------|-------------|
| **Revenue Impact** | High | Does this directly enable or increase revenue? |
| **Urgency** | High | Is this blocking operations or losing money now? |
| **Complexity** | Medium | How much effort to build? (S/M/L/XL) |
| **Dependencies** | Medium | Does this require other systems first? |
| **Operational Leverage** | High | Does this free up the CEO/team to do higher-value work? |
| **Risk** | Low | What happens if we get this wrong? |

## Verdict Labels

- **BUILD NOW** — High ROI, urgent, unblocks operations
- **BUILD LATER** — Good idea, but has dependencies or lower urgency
- **DONT BUILD** — Low ROI, wrong timing, or better solved by SaaS

---

## Triage Results

### BUILD NOW (Phase 1)

| Idea | Source | Rationale |
|------|--------|-----------|
| Real auth + login | All PRDs | Can't have a portal without auth. Clerk is fast. |
| Database + real products | All PRDs | Foundation for everything. Neon + Prisma. |
| Stripe payments | Portal PRD, Tech Stack | Must accept payments to operate. |
| Order creation flow | Portal PRD | Core business process. Replace phone orders. |
| Client dashboard (from DB) | Portal PRD | Clients need to see their data. |
| Order history (from DB) | Portal PRD | Clients need to track orders. |
| Email notifications | Expanded PRD | Buyers + ops need confirmation emails. |
| Admin: view orders | Expanded PRD | Ops team needs to see incoming orders. |

### BUILD LATER (Phase 2-3)

| Idea | Source | Why Later |
|------|--------|-----------|
| Saved carts / reorder | Portal PRD | Needs order history first |
| Invoices + net terms | Portal PRD, Tech Stack | Needs Stripe invoicing setup |
| Rep "build cart for client" | Expanded PRD | Needs roles + multi-org |
| Quote builder | Artifact Ideas | Needs pricing tiers |
| Substitution workflow | Page Design | Needs ops console |
| Pick/pack/ship console | Page Design | Needs order management |
| Account tiers (New/Repeat/VIP) | Portal PRD | Needs more clients first |
| Volume pricing / quantity rules | Artifact Ideas | Needs pricing engine |
| Delivery zone logic | Artifact Ideas | Needs address validation |
| Commission tracking | Tech Stack | Needs sales data |
| Real-time analytics dashboards | Expanded PRD | Needs data in DB first |
| Messages / chat with rep | Portal PRD | Lower priority than ordering |

### DONT BUILD (Use SaaS or Defer Indefinitely)

| Idea | Source | Why Not |
|------|--------|---------|
| Cold outbound email engine | Tech Stack | Out of scope per founder direction |
| IG DM automation (ManyChat) | Research Doc | SaaS solves this; not our platform |
| Call recording / AI coaching | Tech Stack | Use Aircall/Fireflies SaaS when ready |
| CRM (HubSpot/Pipedrive) | Tech Stack | Start with in-app CRM, add SaaS integration later |
| Catch-weight pricing engine | Tech Stack | Complex; defer until real weight data available |
| Shopify B2B integration | Portal PRD | We ARE the custom portal |
| D2C consumer store | PRD Architecture | Keep on existing Shopify site |
| Partner portal | Portal PRD | Premature — need core portal first |
| Knowledge base / SOPs | Portal PRD | Use Notion until portal is mature |
| Mobile native app | Research Doc | PWA from Next.js is sufficient |
| Multi-language | — | US-only market |

## Open Questions

1. **Payment terms policy**: Which tiers get net terms? What deposits? (Need founder input)
2. **SKU master**: Use existing 33 products or import full 200+ SKU list?
3. **Pricing tiers**: How many tiers? What multipliers? (Need founder input)
4. **Delivery zones**: LA/OC local delivery rules — confirm thresholds
5. **Market-rate items**: How to handle volatile pricing in the portal?
