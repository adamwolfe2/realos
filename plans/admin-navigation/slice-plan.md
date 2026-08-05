# Admin Navigation Distillation

Status: COMPLETE
Date: 2026-08-04
Owner: Codex

## Approved outcome

Reduce the internal admin sidebar from roughly twenty-five equal-weight links to eight visible destinations without removing a route, changing permissions, or touching the customer dashboard or the new client Activation page.

## User journey

As LeaseStack agency staff, I can scan the admin navigation quickly, open a task-focused section, and reach every existing admin tool within two clicks.

## Information architecture

- Dashboard
- Insights
- Pipeline: pipeline overview, intake queue, leads, proposals, onboarding pricing
- Sites: site engine, site intelligence
- Marketplace
- Clients
- Client work: creative queue, content drafts, ad campaigns, pixel requests, pixel health
- System: tenants and domains, AppFolio sync, system health, SEO Agent metrics, API costs, audit log, support, bug reports

## Invariants

- Every existing admin route remains represented exactly once.
- Current-route sections open automatically.
- Closed sections roll child badge counts into the parent.
- Desktop and mobile share one navigation component and behavior model.
- Keyboard focus, `aria-expanded`, active labels, and touch targets remain explicit.
- Existing admin authorization, badge queries, pages, client tabs, Activation page, and customer dashboard remain unchanged.

## Verification

- Pure navigation-model tests for route preservation, visible-count, active ancestry, and badge aggregation.
- Rendered component tests for semantic disclosure controls and active child state.
- Desktop and mobile browser checks on production-shaped data.
- TypeScript, ESLint, full Vitest suite, production build, and diff/security checks.

## Completion evidence

- Eight visible destinations on desktop and mobile; every one of the 24 prior routes remains represented exactly once.
- Active sections open automatically; child badges aggregate to collapsed parents; collapsed desktop clusters expand the sidebar before revealing tools.
- Keyboard disclosure semantics include `aria-expanded`, `aria-controls`, `aria-current`, explicit collapsed labels, and focus rings.
- Browser verified at 1689×974 and 390×844 with production-shaped agency data, no document overflow, correct active child state, and shared desktop/mobile behavior.
- 183 Vitest files and 1,944 tests pass; TypeScript, targeted ESLint, diff checks, and production build pass.
- No customer portal, dashboard, Activation page, route, permission, schema, migration, environment, Stripe, or data mutation changes.

## Out of scope

- Deleting or renaming admin tools.
- Changing route URLs, permissions, or data queries.
- Client-detail tab consolidation.
- Customer portal navigation.
- Deleting the production `QA-TEST Applicant` record; that destructive cleanup requires explicit confirmation because it cascades to one linked application.
