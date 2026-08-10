# Property Detail UI Refresh Design

Status: Approved design
Date: 2026-08-09

## Goal

Bring the property detail page into the same compact, light, operational visual system as the current LeaseStack portal without removing existing capabilities or changing its data behavior.

## Information architecture

- Replace the oversized property hero with a compact identity header containing the property image, name, location, property type, and primary actions.
- Place four concise KPI cards immediately below the header using the same hierarchy and blue accents as Attribution.
- Replace the full-width intelligence wall with a compact ranked action queue that emphasizes the next action and severity.
- Group the current property tabs into four discoverable categories: Overview, Marketing, Leasing, and Operations. Preserve every existing `?tab=` deep link.
- Make Overview a balanced two-column dashboard:
  - primary column: marketing pipeline and recent activity;
  - secondary column: integration health, property facts, listing summary, and attributes.

## Visual system

- Use the portal's current white surfaces, neutral borders, compact type scale, and light-blue active/highlight states.
- Remove excessive empty space, tiny uppercase copy, oversized image treatment, and stacked full-width sections.
- Use restrained source and status badges where they improve scanning.
- Keep layouts responsive with horizontally scrollable navigation where necessary.
- No decorative animation, dark theme, gradients, or ornamental charts.

## Behavior and safety

- Preserve image upload and reposition controls in a compact edit affordance.
- Preserve all existing property queries, tenant/property authorization, integration states, tab content, and snapshot links.
- Do not change database schema, billing, integration behavior, recommendation generation, or matching logic.
- Sparse properties continue to receive their existing onboarding-oriented empty state.

## Acceptance checks

- The property identity and core KPIs are visible without a large hero or excessive whitespace.
- Intelligence is compact and actionable rather than visually dominant.
- Every existing property tab remains reachable and every current deep link resolves.
- Overview uses the same spacing, borders, blue accents, and badge language as the refreshed portal.
- Desktop and narrow layouts remain usable without clipped controls or unreadable tables.
