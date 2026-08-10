# Attribution Flow Visual Design

Status: Approved
Date: 2026-08-09

## Goal

Make LeaseStack attribution visually legible without claiming tour data the platform cannot reliably observe.

## Design

- Keep the current page header, filters, KPI summary, review queue, and proof ledger.
- Replace the nine-stage proof strip with one responsive source-to-outcome flow graphic.
- Show LeaseStack-owned sources on the left: Chatbot, Popups and forms, and Visitor pixel.
- Merge those sources into Captured leads, then flow to AppFolio applications and verified signed leases.
- Size source emphasis from real counts. Never invent intermediate values.
- Use restrained light-blue surfaces and blue connecting paths within the existing light Carbon-style system.
- Animate path drawing once on load. Disable the animation for reduced-motion users.
- Omit tours from the primary flow. Calendar-derived stages can return only after a trustworthy integration is connected.
- Preserve accessible text labels and counts so the graphic does not rely on color or motion.

## Data and failure behavior

- Reuse the existing scoped attribution proof query.
- Derive source counts from the same filtered lead cohort shown in the ledger.
- Application and signed counts remain AppFolio-backed.
- Show zero honestly. AppFolio health remains visible beside the filters.
- No schema, mutation, matching-policy, or integration behavior changes.

## Acceptance checks

- Chatbot and form/popup contributions are visible separately.
- The primary visual contains Captured, Applied, and Signed, with no tour stages.
- The graphic works on desktop and collapses into a vertical flow on mobile.
- Reduced-motion users receive a static graph.
- Existing date, source, property filters and CSV export remain unchanged.
