# RE Platform Integrations Roadmap

**Scope:** Identify the top 5 real-estate platforms to integrate with LeaseStack **after** AppFolio and Yardi, ranked for marketing-attribution use cases (lead source → tour → lease → revenue closed-loop).

**Selection criteria** (priority order):
1. API openness (public dev API, reasonable approval bar)
2. Marketing-stack overlap (CRM/leasing > pure accounting)
3. Market presence (# of operators / units managed)
4. Target customer alignment with LeaseStack ICP (mid-market multifamily, student housing, agency-managed portfolios)

> Research date: May 2026. Confidence is noted per claim; market-share figures are rough industry estimates and should be verified before partner pitches.

---

## Summary Table

| # | Platform | Primary Use Case | Target Customer | API Type | Approval Gating | OAuth Effort | Strategic Fit |
|---|----------|------------------|-----------------|----------|-----------------|--------------|---------------|
| 1 | **Entrata** | All-in-one PMS + leasing CRM | Mid/large multifamily, student housing | REST + OAuth 2.0 | Vendor app review (moderate) | M | Highest — owns the leasing funnel end-to-end |
| 2 | **RealPage (OneSite / RPX)** | PMS + CRM (incl. LRO pricing) | Large multifamily, REIT-scale | REST via RealPage Exchange (RPX) API key | Heavy — RPX vendor program, customer-licensed APIs | L | Largest enterprise footprint; gated but worth the wait |
| 3 | **Knock CRM** | Multifamily front-office CRM (leads, tours, AI) | Mid-market multifamily | REST partnership API | Partnership application | M | Pure-play CRM — closest fit to LeaseStack's attribution use case |
| 4 | **Funnel Leasing** | Renter CRM + AI leasing assistant | Mid/large multifamily | REST partner API (developer.funnelleasing.com) | Partner application | M | Modern API, sits *on top* of PMS — same architectural pattern as LeaseStack |
| 5 | **Buildium** | SMB PMS (accounting + leasing) | Small/mid residential operators, agency-managed | REST, client-ID/secret (and OAuth2) | Self-serve API key | S | Easiest to ship; opens SMB / agency-managed segment |

---

## 1. Entrata

- **URL:** https://www.entrata.com — [developer.entrata.com](https://developer.entrata.com/)
- **Primary use case:** End-to-end multifamily operating system: PMS, leasing CRM, accounting, websites, payments.
- **Target customer:** Mid-to-large multifamily operators and student housing. Very strong in 100+ unit communities.
- **Market footprint (rough):** ~3M+ units under management across thousands of properties; consistently top-3 enterprise multifamily platform.
- **API maturity:** Mature public REST APIs + an enhanced OAuth 2.0 program for App Store apps. Token endpoint at `https://sync.entrata.com/api/oauth`. Webhooks available through select APIs.
- **Approval gating:** Yes — App Store / partner-vendor review required. Less restrictive than RealPage Exchange but more than Buildium. Expect documentation review and a sandbox client.
- **OAuth effort:** **M (1–3 days).** Standard OAuth 2.0 authorization-code flow; the bulk of the work is mapping Entrata's resource model (properties → units → prospects → leases) into LeaseStack's attribution schema.
- **Strategic fit:** Owns the **entire leasing funnel** for mid/large operators (ILS lead → guest card → tour → application → lease). For LeaseStack's marketing-attribution story, no integration is higher leverage at this segment. Closing the loop here means we can attribute LeaseStack-sourced leads all the way to signed leases without a third intermediary.
- **Confidence:** High on API existence and OAuth. Medium on exact approval timeline (varies by vendor).

---

## 2. RealPage (OneSite / LRO / RealPage Exchange)

- **URL:** https://www.realpage.com — [developer.realpage.com](https://developer.realpage.com/)
- **Primary use case:** PMS (OneSite), revenue management (LRO / YieldStar), AI Leasing CRM. RealPage runs the largest enterprise multifamily stack in the US.
- **Target customer:** Large multifamily operators, REITs, institutional portfolios. Heavy enterprise tilt.
- **Market footprint (rough):** ~19M+ units across the broader RealPage product family (PMS + adjacent services); single most-cited PMS by REIT-scale operators.
- **API maturity:** Public developer portal exists. Access happens through **RealPage Exchange (RPX)** with API-key auth issued by the Exchange team. Webhooks available for specific data exchanges.
- **Approval gating:** **Heavy.** Two paths:
  - **AppPartner** — solution generally available in the Integration Marketplace; the rigorous path.
  - **Registered Vendor** — APIs are licensed by the *customer* on the vendor's behalf and only available to that named customer. Expansion requires per-customer approval.
  This is the most gated platform on the list — comparable in posture to AppFolio's 5-client + security review, possibly stricter.
- **OAuth effort:** **L (1 week+).** Bulk of the time is approval, vendor onboarding, and per-customer ODE licensing — not raw coding.
- **Strategic fit:** Required for credibility at the enterprise tier. Skip and we lose REIT/large-operator deals to competitors who claim it. Build *after* validating with smaller platforms, because the cycle time is long.
- **Confidence:** High on partner structure. Medium-low on timeline (RPX onboarding is known to take 60–120 days).

---

## 3. Knock CRM

- **URL:** https://www.knockcrm.com
- **Primary use case:** Multifamily **front-office CRM** — lead capture, guest cards, tour scheduling (Knock Now), reporting, AI assistants.
- **Target customer:** Mid-market multifamily; widely deployed across owner-operator portfolios and third-party managers. Often runs *alongside* a PMS like Yardi/Entrata/RealPage, not instead of it.
- **Market footprint (rough):** Used at thousands of communities; one of the two or three most-named pure-play multifamily CRMs (with Funnel and RealPage CRM).
- **API maturity:** Public partnership APIs and PMS integrations. "Knock Now" is an API platform for real-time tour booking from third-party search sites. Bi-directional sync with Yardi/RealPage/Entrata implies a robust integration surface.
- **Approval gating:** Yes — partnership application; less heavy than RPX, comparable to Entrata's app program.
- **OAuth effort:** **M (1–3 days)** once partnership is approved.
- **Strategic fit:** **Most direct overlap with LeaseStack.** Knock's data model (leads → tours → leases with source attribution) maps almost 1:1 to LeaseStack's attribution model. Integrating means we can post LeaseStack-sourced leads as guest cards and read back tour/lease outcomes — pure closed-loop without going through the PMS.
- **Confidence:** High on positioning. Medium on exact API auth method (likely OAuth or signed API keys — confirm at partner kickoff).

---

## 4. Funnel Leasing

- **URL:** https://funnelleasing.com — [developer.funnelleasing.com](https://developer.funnelleasing.com/apis/partner-api)
- **Primary use case:** Next-gen renter CRM with AI leasing assistant; agentic workflows that *centralize* on top of an existing PMS.
- **Target customer:** Mid-to-large multifamily operators looking to consolidate fragmented leasing tech; native bi-directional sync with Yardi, RealPage, Entrata.
- **Market footprint (rough):** Smaller installed base than Knock but growing fast in the modernization tier — the platform large operators choose when they want to replace legacy CRMs without ripping out their PMS.
- **API maturity:** Documented partner REST API at `developer.funnelleasing.com/apis/partner-api`. Supports prospect creation, appointment booking, lease application kickoff. Real-time event streams referenced.
- **Approval gating:** Partner application required; moderate.
- **OAuth effort:** **M (1–3 days).** API is REST + token-based per public docs.
- **Strategic fit:** Funnel's architectural pattern ("sit on top of the PMS, be the single pane of glass") is **the exact same pattern LeaseStack uses on the marketing side**. Integrating positions LeaseStack as the upstream marketing attribution layer to Funnel's leasing-CRM layer — a clean architectural story for operators standardizing on Funnel.
- **Confidence:** High on API existence. Medium on customer-base size (industry-share data is opaque).

---

## 5. Buildium

- **URL:** https://www.buildium.com — [developer.buildium.com](https://developer.buildium.com/)
- **Primary use case:** Cloud PMS for small/mid residential operators — accounting, leasing, marketing, owner portal. Owned by RealPage.
- **Target customer:** Small/mid landlords, single-family rentals, small multifamily, **third-party agency managers**. ICP is broader and far easier to land than enterprise.
- **Market footprint (rough):** Marketed as managing 2M+ units; the dominant SMB PMS along with AppFolio.
- **API maturity:** Public Open API. Authentication via **client ID + secret API keys** in headers (CORS-style), with OAuth2 also documented in some references. Comprehensive REST surface (leads, units, leases, tenants, payments).
- **Approval gating:** **Minimal — effectively self-serve.** Generate API keys from inside the Buildium account. No vendor program to clear. This is the lowest-friction integration on the list.
- **OAuth effort:** **S (<1 day)** if we use API keys (their primary auth). M if we insist on full OAuth2.
- **Strategic fit:** Opens the **agency-managed and SMB segment** — a different ICP than enterprise multifamily but well-aligned with how LeaseStack pitches "managed marketing for portfolios that don't have a CMO." Buildium + AppFolio together cover ~80% of the SMB property-management market.
- **Confidence:** High on API and approval gating. Medium on exact OAuth2 vs API-key behavior (docs reference both — verify before scoping).

---

## Platforms Considered and Deferred

| Platform | Why Deferred |
|----------|--------------|
| **MRI Software** | Public API exists (MIX) but licensed and engineering-vetted; cost-to-integrate is real and ICP skews commercial/affordable housing — not core to LeaseStack's mid-market multifamily story. Revisit for commercial/student housing push. |
| **ResMan** | Solid Partner API, but client base is concentrated in conventional/affordable multifamily; CRM functionality lags Knock/Funnel. Worth adding in a second wave. |
| **DoorLoop** | Clean REST API with API-key auth — technically easy. But customer base is SMB residential with limited marketing-attribution surface. Lower priority than Buildium for SMB coverage. |
| **Rent Manager** | RESTful Web API (WAPI12) with both read/write. Customer base is heavily mixed-use / commercial. Defer to commercial expansion phase. |
| **Rentec Direct / Propertyware / Innago / TenantCloud / Hemlane / Avail** | SMB-tier with thinner CRM/marketing functionality. Long tail — integrate only on customer-driven demand. |
| **LeadSimple** | Adjacent ops/CRM, not a PMS; useful as a partner integration later, not a top-5 RE-platform play. |
| **Rently / Spherexx / Followup CSS / Anyone CRM** | Niche tools (smart tours, marketing-services agencies, legacy CRMs). Partner-only opportunities, not roadmap blockers. |

---

## Counter-Intuitive Findings

- **RealPage is the most gated despite being the largest.** RPX's "Registered Vendor" path means an API integration is licensed *per customer*, not platform-wide. Building it once doesn't unlock the whole RealPage installed base — every customer gets re-approved. This is materially worse than AppFolio's 5-client gate.
- **Buildium is shockingly self-serve.** Despite being owned by RealPage, Buildium kept its open API and lets developers generate keys from inside the app. Among the top 5 it has the lowest engineering effort by an order of magnitude — but it's last on the priority list because its ICP overlaps least with our mid-market multifamily wedge.
- **Funnel Leasing's developer portal is fully public** at `developer.funnelleasing.com` — better surfaced than RealPage's enterprise portal despite Funnel being a fraction of the size. Suggests they're explicitly courting integrators.
- **Knock has the cleanest "marketing-attribution" data model** of any platform we evaluated — it was built CRM-first, not accounting-first. For LeaseStack's narrative, Knock may be more strategically valuable than Yardi over the next 18 months even though Yardi has 10× the installed base.

---

## Recommended Sequence

```
1. AppFolio        (already on roadmap — gated, 5-client + security review)
2. Yardi           (already on roadmap — enterprise PMS coverage)
3. Entrata         ← BUILD NEXT
4. Knock CRM
5. Funnel Leasing
6. Buildium
7. RealPage / RPX  (start the partner application *now*, ship last due to 60–120 day approval)
```

### Why **Entrata** next

- **Highest leverage per engineering hour.** OAuth 2.0 is documented and standard; approval is real but not RPX-level. Effort is M, expected impact is enterprise-tier coverage.
- **Completes the "big three" PMS story.** AppFolio + Yardi + Entrata is the credibility triangle every multifamily marketing buyer asks about. Without Entrata, we leave large-operator deals unwinnable.
- **Owns the funnel end-to-end** at its accounts (PMS + leasing CRM in one platform), so the closed-loop attribution story is cleanest there — no second integration needed to read lease outcomes.
- **Unblocks Knock and Funnel.** Both CRMs sync to Entrata; building the Entrata connector first creates a data model we can reuse when wiring Knock/Funnel webhooks.

### Parallel action

Start the **RealPage Exchange vendor application** the same week Entrata work kicks off. Their 60–120 day approval timeline means RPX is the long pole — submit early so it's ready when we finish Entrata + Knock + Funnel.

---

## Sources

- [Entrata Developer Portal](https://developer.entrata.com/)
- [Entrata App Store Technical Docs](https://docs.entrata.com/app-store/technical)
- [RealPage Developer Portal](https://developer.realpage.com/)
- [RealPage Exchange (RPX)](https://www.realpage.com/exchange/)
- [Knock CRM Platform Overview](https://www.knockcrm.com/what-we-do/)
- [Funnel Leasing Partner API](https://developer.funnelleasing.com/apis/partner-api)
- [Buildium Open API](https://developer.buildium.com/)
- [MRI Information eXchange (MIX)](https://www.mrisoftware.com/products/mri-information-exchange/)
- [ResMan Partners API Documentation](https://partners-api-docs.myresman.com/)
- [DoorLoop API Reference](https://api.doorloop.com/reference/introduction)
- [Rent Manager Web API Technical Documentation](https://info.rentmanager.com/hubfs/PDFs/Technical%20Documentation.pdf)
