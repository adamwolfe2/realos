# TBGC Research Documents Index

These documents were created during product discovery and strategy research using Perplexity, Grok, ChatGPT, and Claude. They inform the product roadmap but are NOT implementation specs.

## Documents

| # | File | TL;DR |
|---|------|-------|
| 1 | [portal-prd.md](./portal-prd.md) | 3-track plan (MVP → Shopify B2B → Headless). Feature universe for client portal, sales rep console, admin ops. CRM pipeline. GTM channels. |
| 2 | [prd-architecture.md](./prd-architecture.md) | Platform choices (Shopify Plus vs Lovable vs Hybrid). Concrete stack by layer. Distribution channels + GTM. |
| 3 | [tbgc-tech-stack-ideas.md](./tbgc-tech-stack-ideas.md) | Deep tech stack evaluation. Freshline vs Shopify vs custom. CRM comparison. Payment processing. Inventory (FEFO). Marketing automation. Full pricing. |
| 4 | [tgbc-expanded-prd-ideas.md](./tgbc-expanded-prd-ideas.md) | Expanded PRD with epics, user stories, acceptance criteria. SKU master CSV spec. Sales ops playbook. Shopify B2B implementation checklist. |
| 5 | [artifact-ideas.md](./artifact-ideas.md) | SKU master CSV headers + example rows. Portal PRD v1 (epics). Sales ops playbook (pipeline, scripts, winback). Implementation checklist. |
| 6 | [page-design-ideas.md](./page-design-ideas.md) | Screen-by-screen spec: Buyer Portal (14 screens), Rep Console (6 screens), Ops Console (6 screens), Admin/Finance (7 screens). Fields, states, buttons, permissions. |
| 7 | [tbgc-research-info-doc.md](./tbgc-research-info-doc.md) | Competitive intelligence. Market sizing ($178M US truffle market). Competitor analysis (Regalis, Urbani, Sabatino, Petrossian, Marky's). Marketing strategy. |

## Key Decisions Implied by Research

1. Custom portal (Next.js + headless) is the right long-term path — already building it
2. Postgres (Neon/Supabase) for custom objects beyond what any SaaS covers
3. Stripe for payments + potential net terms solution later
4. CRM is portal-integrated, not a separate SaaS (for now)
5. Inventory management starts simple — connected to real data sources later
6. No cold outbound through this platform — focus is CRM + portal + payments + inventory

## Source Files

Original `.docx` files preserved in `docs/_source/` for reference.
